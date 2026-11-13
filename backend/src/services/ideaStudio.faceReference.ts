import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { uploadsDir } from "../config";
import { StudioError } from "./ideaStudio.validation";
import { readStudioReference, studioReferencePath } from "./ideaStudio.references";

export type FaceGeometry = {
  box: { xMin: number; yMin: number; width: number; height: number };
  keypoints: Array<{ name?: string; x: number; y: number }>;
};
let detectorPromise: Promise<import("@tensorflow-models/face-detection").FaceDetector> | undefined;
async function faceDetector() {
  if (!detectorPromise) detectorPromise = (async () => {
    const tf = await import("@tensorflow/tfjs-core");
    await import("@tensorflow/tfjs-backend-cpu");
    const faceDetection = await import("@tensorflow-models/face-detection");
    await tf.setBackend("cpu");
    await tf.ready();
    const dir = path.resolve(__dirname, "../../models/face-detection");
    const model = JSON.parse(await fs.readFile(path.join(dir, "model.json"), "utf8"));
    const chunks: Buffer[] = [];
    for (const group of model.weightsManifest) for (const file of group.paths) {
      if (!/^[a-zA-Z0-9_.-]+$/.test(file)) throw Error("Invalid model shard");
      chunks.push(await fs.readFile(path.join(dir, file)));
    }
    const weights = Buffer.concat(chunks);
    return faceDetection.createDetector(faceDetection.SupportedModels.MediaPipeFaceDetector, {
      runtime: "tfjs", modelType: "full", maxFaces: 4,
      detectorModelUrl: tf.io.fromMemory({
        modelTopology: model.modelTopology,
        weightSpecs: model.weightsManifest.flatMap((group: any) => group.weights),
        weightData: weights.buffer.slice(weights.byteOffset, weights.byteOffset + weights.byteLength) as ArrayBuffer,
      }),
    });
  })().catch(() => {
    detectorPromise = undefined;
    throw new StudioError("Не удалось подготовить локальную модель лица. Платная генерация не запускалась.", 503);
  });
  return detectorPromise;
}

export async function detectReferenceFace(bytes: Buffer): Promise<FaceGeometry> {
  const tf = await import("@tensorflow/tfjs-core");
  const detector = await faceDetector();
  const { data, info } = await sharp(bytes).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], "int32");
  try {
    const faces = await detector.estimateFaces(tensor, { flipHorizontal: false });
    if (faces.length !== 1) throw new StudioError(faces.length
      ? "На референсе несколько лиц. Загрузите фото только нужного персонажа."
      : "Не удалось найти лицо на референсе. Загрузите более крупное, чёткое фото лица, где видны оба глаза.", 400);
    return faces[0];
  } finally { tensor.dispose(); }
}

export function faceAlignment(face: FaceGeometry) {
  const eyes = [face.keypoints.find(p => p.name === "leftEye"), face.keypoints.find(p => p.name === "rightEye")];
  const b = face.box;
  if (!eyes[0] || !eyes[1] || ![b.xMin,b.yMin,b.width,b.height,...eyes.flatMap(p=>[p!.x,p!.y])].every(Number.isFinite) || b.width < 40 || b.height < 40)
    throw new StudioError("Лицо слишком маленькое или глаза плохо видны. Загрузите более крупный портрет.");
  const [left, right] = eyes.sort((a,b)=>a!.x-b!.x) as [{x:number;y:number},{x:number;y:number}];
  const dx = right.x-left.x, dy = right.y-left.y;
  if (dx < b.width*0.14 || dx > b.width || Math.hypot(dx,dy) < 15)
    throw new StudioError("Нужен референс с двумя хорошо видимыми глазами. Попробуйте фото ближе к анфас.");
  const roll = Math.atan2(dy, dx)*180/Math.PI;
  if (Math.abs(roll)>45) throw new StudioError("Слишком сильный наклон референса. Загрузите портрет с более прямым положением головы.");
  return {
    roll,
    size: Math.ceil(Math.max(b.width,b.height)*1.55),
    centerX: b.xMin+b.width/2,
    centerY: b.yMin+b.height*0.43,
  };
}

export async function alignFaceReference(bytes: Buffer, face: FaceGeometry) {
  const { roll, size, centerX, centerY } = faceAlignment(face);
  const meta = await sharp(bytes).metadata();
  const x = Math.floor(centerX-size/2), y = Math.floor(centerY-size/2);
  const left=Math.max(0,x), top=Math.max(0,y);
  const width=Math.min(meta.width!,x+size)-left, height=Math.min(meta.height!,y+size)-top;
  if (width<=0 || height<=0) throw new StudioError("Не удалось выделить лицо на референсе.");
  const background = { r: 216, g: 214, b: 211, alpha: 1 };
  const crop = await sharp(bytes).extract({left,top,width,height}).extend({
    left:left-x, top:top-y, right:size-width-(left-x), bottom:size-height-(top-y), background,
  }).png().toBuffer();
  const rotated = await sharp(crop).rotate(-roll,{background}).png().toBuffer({resolveWithObject:true});
  return sharp(rotated.data).extract({
    left:Math.floor((rotated.info.width-size)/2), top:Math.floor((rotated.info.height-size)/2), width:size,height:size,
  }).resize(768,768,{fit:"fill"}).jpeg({quality:95}).toBuffer();
}

const pending = new Map<string, Promise<Buffer>>();
export async function prepareStudioReference(key: string, root = uploadsDir): Promise<Buffer> {
  const original = studioReferencePath(key,root);
  const file = original.replace(/\.jpg$/, ".identity-v1.jpg");
  const active = pending.get(file);
  if (active) return active;
  try { return await fs.readFile(file); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const existing = pending.get(file);
  if (existing) return existing;
  const work = (async()=>{
    const bytes = await readStudioReference(key,root);
    const face = await detectReferenceFace(bytes);
    const prepared = await alignFaceReference(bytes,face);
    const temp = `${file}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temp,prepared,{mode:0o600});
      await fs.rename(temp,file);
    } finally { await fs.unlink(temp).catch(()=>undefined); }
    return prepared;
  })();
  pending.set(file,work);
  try { return await work; } finally { pending.delete(file); }
}
