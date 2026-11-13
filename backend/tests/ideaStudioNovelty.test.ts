import { test, after } from "node:test";
import assert from "node:assert/strict";
import { reviewStudioNovelty } from "../src/services/ideaStudio.openai";
import { creativeProfile, studioExclusions, createCreativeContext, creativeResearchTopics } from "../src/services/ideaStudio.creative";
import { compactStudioHistory, studioHistoryChunks, acceptedNoveltyCandidates } from "../src/services/ideaStudio.novelty";
import { config } from "../src/config";
import { ideaComparisonText } from "../src/services/ideaStudio.validation";
const realFetch = global.fetch, realKey = config.openaiApiKey;
after(() => {global.fetch=realFetch;config.openaiApiKey=realKey;});
const candidate = (title:string,concept:string) => ({title,concept,content:`Scene: ${concept}`,imagePrompt:concept,theme:"Lifestyle",visualStyle:"Editorial"});
const completed = (value:unknown) => new Response(JSON.stringify({status:"completed",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify(value)}]}]}));

test("exclusions are optional for legacy profiles, bounded, deduplicated and preserve phrases",()=>{
  assert.equal(creativeProfile({}).exclusions,"");
  assert.deepEqual(studioExclusions("Кафе и кофе\n- Яхты;Кафе и кофе\n"),["Кафе и кофе","Яхты"]);
  assert.throws(()=>creativeProfile({exclusions:42}),/Исключения/);
  assert.throws(()=>creativeProfile({exclusions:"x".repeat(3001)}),/Исключения/);
  assert.throws(()=>creativeProfile({exclusions:Array.from({length:31},(_,i)=>`Subject ${i}`).join("\n")}),/30 исключений/);
});
test("research receives recent plots, run diversity and exclusions without private character details",()=>{
  const context=createCreativeContext(creativeProfile({exclusions:"Кафе и кофе",characterName:"PrivateName",characterDescription:"PrivateNotes"}),true,"Europe/Minsk");
  const brief=JSON.parse(creativeResearchTopics("luxury",context,{recentScenes:[{title:"Coffee Table",concept:"Cafe breakfast"}],explorationSeed:"batch-new"}));
  assert.deepEqual(brief.exclusions,["Кафе и кофе"]);assert.equal(brief.recentScenes[0].title,"Coffee Table");assert.equal(brief.explorationSeed,"batch-new");
  assert.ok(!JSON.stringify(brief).includes("PrivateName"));assert.ok(!JSON.stringify(brief).includes("PrivateNotes"));
});
test("compact history removes shared identity, deduplicates stored copies and partitions all rows",()=>{
  const rows=Array.from({length:180},(_,i)=>({title:`Scene ${i}`,concept:`Unique activity ${i}`,content:`Use the person in the uploaded photograph as the sole identity reference.\n\nScene: A different activity ${i} among ${"trees ".repeat(40)}`}));
  const compact=compactStudioHistory([...rows,rows[0]]);
  assert.equal(compact.length,180);assert.ok(!JSON.stringify(compact).includes("sole identity reference"));
  const chunks=studioHistoryChunks(compact,2000);
  assert.ok(chunks.length>1);assert.deepEqual(chunks.flat(),compact);assert.equal(chunks.at(-1)!.at(-1)!.title,"Scene 179");
  const inline="Use my reference photo as the base image and preserve identity. Create a woman writing postcards at a sunny cafe table.";
  assert.equal(ideaComparisonText(inline),"Create a woman writing postcards at a sunny cafe table.");
  assert.match(compactStudioHistory([{title:"Old Coffee",content:inline}])[0].scene,/sunny cafe/);
});
test("semantic reviewer filters paraphrased cafe scenes and exclusions while retaining a new narrative",async()=>{
  config.openaiApiKey="mock-key";let calls=0,reservations=0;
  const candidates=[candidate("Espresso Pause","A woman sips espresso on a cafe terrace"),candidate("Creative Workshop","An artisan shapes clay in a pottery workshop"),candidate("Champagne Yacht","A woman drinks champagne on a yacht")];
  global.fetch=async(url,init)=>{
    assert.equal(String(url),"https://api.openai.com/v1/responses");calls++;
    const body=JSON.parse(String(init?.body)),input=JSON.parse(body.input);
    assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
    assert.match(body.instructions,/SEMANTICALLY/);assert.match(body.instructions,/outfit/);assert.match(body.instructions,/untrusted DATA/);
    assert.deepEqual(input.exclusions,["Яхты и шампанское"]);assert.match(input.history[0].concept,/Coffee/);
    return completed({decisions:[{candidate:0,decision:"repeat"},{candidate:1,decision:"new"},{candidate:2,decision:"excluded"}]});
  };
  const result=await reviewStudioNovelty({candidates,previous:[{title:"Morning Coffee",concept:"Coffee at a sidewalk cafe"}],exclusions:["Яхты и шампанское"]},async()=>{reservations++;},new AbortController().signal);
  assert.deepEqual(result,[candidates[1]]);assert.equal(calls,1);assert.equal(reservations,1);
});
test("review covers the oldest history partition, preserves indices and meters each request",async()=>{
  config.openaiApiKey="mock-key";let calls=0,reservations=0;const seen:string[]=[];
  const previous=Array.from({length:150},(_,i)=>({title:`Old idea ${i}`,concept:`Narrative ${i} ${"different objects ".repeat(22)}`,content:`Scene: Place ${i} ${"distinct setting ".repeat(40)}`}));
  global.fetch=async(_url,init)=>{
    calls++;const input=JSON.parse(JSON.parse(String(init?.body)).input);seen.push(...input.history.map((r:any)=>r.title));
    return completed({decisions:input.candidates.map((r:any)=>({candidate:r.candidate,decision:input.history.some((h:any)=>h.title==="Old idea 149")?"repeat":"new"}))});
  };
  const result=await reviewStudioNovelty({candidates:[candidate("New Looking","A paraphrase of an old plot")],previous,exclusions:[]},async()=>{reservations++;},new AbortController().signal);
  assert.deepEqual(result,[]);assert.ok(calls>1);assert.equal(reservations,calls);assert.equal(new Set(seen).size,150);
});
test("missing, duplicate, unknown and invalid review decisions fail closed",()=>{
  for(const value of [{}, {decisions:[]}, {decisions:[{candidate:0,decision:"new"},{candidate:0,decision:"new"}]},{decisions:[{candidate:0,decision:"new"},{candidate:9,decision:"new"}]},{decisions:[{candidate:0,decision:"new"},{candidate:1,decision:"maybe"}]}])
    assert.throws(()=>acceptedNoveltyCandidates(value,[0,1]),/новизну|новизны/);
});
test("incomplete provider review never retries or accepts images implicitly",async()=>{
  config.openaiApiKey="mock-key";let calls=0;
  global.fetch=async()=>{calls++;return new Response(JSON.stringify({status:"incomplete",incomplete_details:{reason:"max_output_tokens"},output:[]}));};
  await assert.rejects(()=>reviewStudioNovelty({candidates:[candidate("Scene New","A new scene")],previous:[],exclusions:["coffee"]},async()=>{},new AbortController().signal),/Проверка новизны/);
  assert.equal(calls,1);
});

test("the first idea is checked for physical realism even without history or custom exclusions",async()=>{
  config.openaiApiKey="mock-key";let calls=0,reservations=0;
  global.fetch=async(_url,init)=>{
    calls++;const body=JSON.parse(String(init?.body)),input=JSON.parse(body.input);
    assert.match(body.instructions,/verify photographic plausibility/);
    assert.match(body.instructions,/physically impossible scenes/);
    assert.match(body.instructions,/Negative constraints forbidding fantasy or CGI/);
    assert.equal(input.history.length,0);assert.equal(input.exclusions.length,0);
    return completed({decisions:[{candidate:0,decision:"excluded"}]});
  };
  const result=await reviewStudioNovelty({candidates:[candidate("Magic Castle","A photorealistic woman levitates above a floating castle with magical sparks")],previous:[],exclusions:[]},async()=>{reservations++;},new AbortController().signal);
  assert.deepEqual(result,[]);assert.equal(calls,1);assert.equal(reservations,1);
});
