import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultStudioTelegramPublication,buildStudioTelegramPostTemplate,renderStudioTelegramPostHtml } from "../src/services/ideaStudio.telegramPublication";
import { defaultStudioTelegramPublication as frontendDefault } from "../../miniapp/src/utils/studioTelegramPublication";
const vars={headline:"Title",category:"Images",hashtags:"#test",channel:"https://t.me/channel",link:"https://t.me/prmtb_bot?startapp=prompt_33"};
test("studio announcement matches the requested text, spacing and embedded links",()=>{
  const html=renderStudioTelegramPostHtml(buildStudioTelegramPostTemplate(),vars);
  assert.equal(html,`Новый промпт\n\n1. Переходи в бот <a href="https://t.me/syntxaibot?start=aff_465351635">Ссылка</a>\n2. Жми "Дизайн с ИИ" → "Nano Banana Pro"\n3. По желанию выбирай модель, качество и соотношение сторон в "Настройки модели"\n4. Загружай свой референс и вставляй промпт ↓\n\n<a href="https://t.me/prmtb_bot?startapp=prompt_33">Открыть промпт</a>`);
  assert.ok(html.length<1024);assert.ok(!html.includes("{{"));
});
test("client and server share identical initial publication values",()=>{
  assert.deepEqual(frontendDefault(),defaultStudioTelegramPublication());
});
test("every prompt receives its own application link with no double-escaped query parameters",()=>{
  const template=buildStudioTelegramPostTemplate({bodyHtml:'<p>A <a href="https://example.com/?a=1&amp;b=2">reference</a></p>',promptLinkLabel:"Read & use"});
  const first=renderStudioTelegramPostHtml(template,vars);
  const second=renderStudioTelegramPostHtml(template,{...vars,link:vars.link.replace("_33","_34")});
  assert.match(first,/prompt_33/);assert.match(second,/prompt_34/);assert.ok(!second.includes("prompt_33"));
  assert.match(first,/a=1&amp;b=2/);assert.ok(!first.includes("&amp;amp;"));assert.match(first,/Read &amp; use/);
});
test("unsafe markup is removed and unsafe links cannot enter the publication queue",()=>{
  const template=buildStudioTelegramPostTemplate({bodyHtml:'<p onclick="evil()">Hello <strong>world</strong><script>evil()</script><img src="x" onerror="evil()"></p>',promptLinkLabel:"Open"});
  const html=renderStudioTelegramPostHtml(template,vars);
  assert.match(html,/<b>world<\/b>/);assert.doesNotMatch(html,/script|onclick|onerror|<img|evil/);
  for(const href of ["javascript:alert(1)","//evil.test/","data:text/html,bad","&#106;avascript:alert(1)"])
    assert.throws(()=>buildStudioTelegramPostTemplate({bodyHtml:`<p><a href="${href}">Bad link</a></p>`,promptLinkLabel:"Open"}),/полную ссылку/);
});
test("empty and oversized captions are rejected instead of truncating the application link",()=>{
  assert.throws(()=>buildStudioTelegramPostTemplate({bodyHtml:"<p></p>",promptLinkLabel:"Open"}),/пустым/);
  assert.throws(()=>buildStudioTelegramPostTemplate({bodyHtml:`<p>${"x".repeat(1100)}</p>`,promptLinkLabel:"Open"}),/слишком длинный/);
  assert.throws(()=>buildStudioTelegramPostTemplate({bodyHtml:"<p>Hello</p>",promptLinkLabel:" "}),/Текст ссылки/);
  assert.throws(()=>buildStudioTelegramPostTemplate({bodyHtml:"<p>{{link}}</p>",promptLinkLabel:"Open"}),/автоматически/);
});
