import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { alignFaceReference, faceAlignment, prepareStudioReference, type FaceGeometry } from "../src/services/ideaStudio.faceReference";
import { storeStudioReference, studioReferencePath } from "../src/services/ideaStudio.references";

function geometry(dy=30): FaceGeometry {
  return {box:{xMin:70,yMin:70,width:180,height:200},keypoints:[
    {name:"leftEye",x:200,y:125+dy},{name:"rightEye",x:120,y:125},
  ]};
}
test("face-only preparation physically levels the eyes for both roll directions", async()=>{
  for(const dy of [-30,30]) {
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#888888"/><rect y="350" width="400" height="150" fill="#0000ff"/><circle cx="120" cy="125" r="6" fill="#ff0000"/><circle cx="200" cy="${125+dy}" r="6" fill="#00ff00"/></svg>`;
    const bytes=await sharp(Buffer.from(svg)).png().toBuffer();
    const aligned=await alignFaceReference(bytes,geometry(dy));
    const {data,info}=await sharp(aligned).raw().toBuffer({resolveWithObject:true});
    const centers=[{x:0,y:0,n:0},{x:0,y:0,n:0}];
    let bodyPixels=0;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
      const i=(y*info.width+x)*3, r=data[i],g=data[i+1],b=data[i+2];
      const marker=r>180&&g<80&&b<80?0:g>180&&r<80&&b<80?1:-1;
      if(marker>=0){centers[marker].x+=x;centers[marker].y+=y;centers[marker].n++;}
      if(b>180&&r<80&&g<80)bodyPixels++;
    }
    assert.ok(centers.every(p=>p.n>5));
    assert.ok(Math.abs(centers[0].y/centers[0].n-centers[1].y/centers[1].n)<2);
    assert.equal(bodyPixels,0);
    assert.equal(info.width,768);assert.equal(info.height,768);
  }
});
test("face geometry rejects unreadable eyes and extreme rotation instead of copying the original",()=>{
  assert.ok(faceAlignment(geometry()).roll>0);
  assert.throws(()=>faceAlignment({...geometry(),keypoints:[]}),/глаза/);
  assert.throws(()=>faceAlignment(geometry(150)),/наклон/);
  assert.throws(()=>faceAlignment({...geometry(),box:{...geometry().box,width:20}}),/маленькое/);
});
test("prepared cache stays private and leaves the original reference intact",async()=>{
  const root=await mkdtemp(path.join(tmpdir(),"studio-face-"));
  try{
    const bytes=await sharp({create:{width:128,height:128,channels:3,background:"#cccccc"}}).jpeg().toBuffer();
    const key=await storeStudioReference(bytes,root);
    const original=await readFile(studioReferencePath(key,root));
    const prepared=await sharp({create:{width:768,height:768,channels:3,background:"#dddddd"}}).jpeg().toBuffer();
    await writeFile(studioReferencePath(key,root).replace(/\.jpg$/,".identity-v1.jpg"),prepared);
    assert.deepEqual(await prepareStudioReference(key,root),prepared);
    assert.deepEqual(await readFile(studioReferencePath(key,root)),original);
  }finally{await rm(root,{recursive:true,force:true});}
});
test("bundled detector runs offline and refuses a reference with no face",async()=>{
  const root=await mkdtemp(path.join(tmpdir(),"studio-face-empty-"));
  const originalFetch=global.fetch;
  global.fetch=async()=>{throw Error("Unexpected network access");};
  try{
    const bytes=await sharp({create:{width:256,height:256,channels:3,background:"#999999"}}).jpeg().toBuffer();
    const key=await storeStudioReference(bytes,root);
    await assert.rejects(()=>prepareStudioReference(key,root),/найти лицо/);
    assert.deepEqual(await readdir(path.join(root,".studio-references")),[key]);
  }finally{global.fetch=originalFetch;await rm(root,{recursive:true,force:true});}
});
