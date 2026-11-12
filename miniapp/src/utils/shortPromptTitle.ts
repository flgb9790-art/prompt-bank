// Pure local title generator. Keep the browser copy in sync (covered by title tests).
type Theme = { title: string; clues: RegExp[] };
const theme = (title: string, ...clues: RegExp[]): Theme => ({ title, clues });

const themes: Theme[] = [
  theme("Портрет у бильярда", /\bbilliards?\b|бильярд/u),
  theme("Красная дорожка", /red.carpet|красн\p{L}* дорожк/u),
  theme("Китайская стена", /great wall|китайск\p{L}* стен/u),
  theme("Египетские пирамиды", /\bgiza\b|\bpyramids?\b|пирамид/u),
  theme("Зимний Куршевель", /courchevel|куршевел/u),
  theme("Мальдивский отдых", /maldives|мальдив/u),
  theme("Ночной Дубай", /\bdubai\b|burj khalifa|дуба[йе]/u),
  theme("Венецианское кафе", /\bvenice\b|grand canal|венец/u),
  theme("Парижский шопинг", /\bparis\b|avenue montaigne|париж/u, /shopping|boutique|шопинг|бутик/u),
  theme("Мандариновый сад", /mandarin|tangerine|мандарин/u, /orchard|tree|сад|дерев/u),
  theme("Маковое поле", /popp(?:y|ies)|маков/u),
  theme("Пшеничное поле", /\bwheat\b|пшениц|пшенич/u),
  theme("Конный клуб", /equestrian|riding boots|конн\p{L}* клуб/u),
  theme("Портрет с лошадью", /\bhorse\b|лошад|кон[ьяе]/u),
  theme("Портрет с драконом", /\bdragon\b|дракон/u),
  theme("Жемчужная ванна", /\bpearls?\b|жемчуг|жемчуж/u, /bathtub|ванн/u),
  theme("Цветочная буря", /pink flowers|pink peonies|розов\p{L}* цвет|пион/u, /floating|storm|swirl|парящ|бур[яи]/u),
  theme("Белые цветы", /white blossoms|white magnolia|бел\p{L}* цвет/u),
  theme("Мыльные пузыри", /soap bubbles|мыльн\p{L}* пузыр/u),
  theme("Цифровой тоннель", /digital tunnel|floating screens|digital panels|цифров\p{L}* тоннел/u),
  theme("Неоновое движение", /neon|неон/u, /motion blur|panning|streak|размыти|движени/u),
  theme("Человек среди движения", /motion.blur|blurred motion|размыти\p{L}* движени/u, /pedestrians|silhouettes|crowd|прохож|толп|силуэт/u),
  theme("Портрет в наушниках", /headphones|наушник/u),
  theme("Взлёт над моделью", /airplane|passenger plane|самол[её]т/u, /overhead|low.over|над голов/u),
  theme("Частный самолёт", /private jet|first.class jet|частн\p{L}* самол|бизнес.джет/u),
  theme("Вертолётная площадка", /helicopter|вертол[её]т/u),
  theme("Аэропортный стиль", /airport|аэропорт/u),
  theme("Портрет в метро", /\bmetro\b|subway|метро/u),
  theme("Футбольный стадион", /stadium|world cup|стадион|футбол/u),
  theme("Ночная ярмарка", /ferris wheel|carnival|night fair|ярмарк|карусел/u),
  theme("Испанская вечеринка", /spanish|spain|испан/u, /party|danc|вечеринк|танц/u),
  theme("Ночной скутер", /scooter|скутер/u, /\bnight\b|ноч[ьи]/u),
  theme("Летний скутер", /scooter|скутер/u),
  theme("Жёлтая Феррари", /ferrari|феррари/u, /\byellow\b|ж[её]лт/u),
  theme("Красная Феррари", /ferrari|феррари/u, /\bred\b|красн/u),
  theme("Розовый Порше", /porsche|порше/u, /\bpink\b|розов/u),
  theme("Роскошный Бентли", /bentley|бентли/u),
  theme("Портрет у Гелендвагена", /g.wagon|g.wagen|g.class|гелендваген/u),
  theme("Салон Роллс-Ройса", /rolls.royce|роллс/u),
  theme("Ночной спорткар", /sports car|supercar|спорткар/u, /\bnight\b|ноч[ьи]/u),
  theme("Автомобильный портрет", /ferrari|porsche|luxury car|феррари|порше|автомобил/u),
  theme("Закат на яхте", /\byacht\b|яхт/u, /sunset|golden.hour|закат/u),
  theme("Морская яхта", /\byacht\b|яхт/u),
  theme("Термальный бассейн", /thermal pool|hot spring|термальн|горяч\p{L}* источник/u),
  theme("Зимнее шале", /\bchalet\b|шале/u),
  theme("Осеннее озеро", /\blake\b|озер|озёр/u, /autumn|fall foliage|осен/u),
  theme("Портрет на пирсе", /\bpier\b|пирс|причал/u),
  theme("Портрет на дороге", /lying.*(?:asphalt|road)|леж\p{L}*.*(?:дорог|асфальт)/u),
  theme("Тропический отдых", /\bbeach\b|пляж|берег/u, /tropical|palm|coconut|тропич|пальм|кокос/u),
  theme("Прогулка на закате", /shoreline|walking along.*beach|прогулк|ид[её]т/u, /sunset|закат/u),
  theme("Пляжный шезлонг", /sun.lounger|sunbathing|шезлонг|загора/u),
  theme("Морской закат", /\bsea\b|\bbeach\b|seaside|ocean|мор[еяю]|пляж|океан/u, /sunset|golden.hour|закат/u),
  theme("Пляжный портрет", /\bbeach\b|seaside|\bsea\b|ocean|пляж|мор[еяю]|океан/u),
  theme("Прогулка по пустыне", /\bdesert\b|пустын/u),
  theme("Галерейный вечер", /art gallery|gallery opening|художественн\p{L}* галере|вернисаж/u),
  theme("Ювелирный бутик", /jewelry boutique|jewellery boutique|ювелирн/u),
  theme("Клубная библиотека", /\blibrary\b|библиотек/u),
  theme("Мраморная лестница", /marble staircase|мраморн\p{L}* лестниц/u),
  theme("Дизайнерская примерочная", /fitting room|примерочн/u),
  theme("Утро в пентхаусе", /penthouse|пентхаус/u, /morning|утр[оа]/u),
  theme("Роскошный пентхаус", /penthouse|пентхаус/u),
  theme("Селфи в зеркале", /mirror.selfie|selfie.*mirror|селфи.*зеркал|зеркальн\p{L}* селфи/u),
  theme("Вечернее селфи", /\bselfie\b|селфи/u, /party|restaurant|evening|вечер|ресторан/u),
  theme("Летнее селфи", /\bselfie\b|селфи/u),
  theme("Солнечная крыша", /rooftop|roof.*ledge|крыш[аеу]/u, /blue sky|sunlit|bright|солнеч|ярк/u),
  theme("Портрет на крыше", /rooftop|roof.*ledge|крыш[аеу]/u),
  theme("Городской балкон", /balcony|terrace overlooking|балкон/u),
  theme("Меховой глянец", /\bfur\b|мехов/u, /coat|throne|шуб|трон/u),
  theme("Уютный портрет", /teddy.texture|fuzzy chair|plush.*armchair|knitted sweater|cozy.*sofa|уютн|пушист\p{L}* кресл/u),
  theme("Портрет у окна", /near a window|window.ledge|beside.*window|у окна|подоконник/u),
  theme("Портрет на диване", /\bsofa\b|диван/u),
  theme("Красное кресло", /red.*chair|красн\p{L}* кресл/u),
  theme("Зимний глянец", /winter|\bfur\b|зимн|шуб[аыу]|мехов/u),
  theme("Городской ракурс", /fisheye|wide.angle|low.angle|снизу|широкоугол/u, /skyscrapers|business district|небоскреб|небоскрёб/u),
  theme("Реклама напитка", /beverage|drink bottle|реклам\p{L}* напит|бутылк/u),
  theme("Парящая косметика", /cosmetic|skincare|косметик/u, /levitation|hover|парящ|левитац/u),
  theme("Реклама косметики", /cosmetic|skincare|perfume|косметик|парфюм/u),
  theme("Модная карикатура", /caricature|карикатур/u),
  theme("Аниме скетчбук", /sketch|скетч|наброс/u, /\banime\b|chibi|аниме|чиби/u),
  theme("Рисованный скетчбук", /sketchbook|sketch|скетчбук|набросок/u),
  theme("Аниме персонаж", /\banime\b|chibi|аниме|чиби/u),
  theme("Серебряный футуризм", /visor|mirrored.*sunglasses|визор|футурист/u),
  theme("Студийный портрет", /\bstudio\b|студийн/u, /portrait|model|woman|портрет|модел/u),
  theme("Уличный стиль", /street.style|urban|city street|уличн|городск/u),
  theme("Бьюти портрет", /beauty|close.up|бьюти|крупн\p{L}* план/u),
  theme("Модный портрет", /fashion|editorial|portrait|фэшн|портрет|фотосесси/u),
  theme("Телеграм бот", /telegram|телеграм/u, /\bbot\b|бот/u),
  theme("Лендинг продукта", /landing.page|лендинг/u),
  theme("Интерфейс приложения", /\breact\b|user.interface|dashboard|интерфейс|дашборд/u),
  theme("Дизайн логотипа", /\blogo\b|логотип/u),
  theme("Фирменный стиль", /branding|brand.identity|брендинг|айдентик/u),
  theme("Рекламная кампания", /marketing|advertis|маркетинг|реклам/u),
  theme("План путешествия", /itinerary|travel.plan|маршрут|план путешеств/u),
  theme("План тренировок", /workout|training.plan|трениров/u),
  theme("План питания", /meal.plan|план питани/u),
  theme("Анализ данных", /data.analysis|analy[sz]e.*data|анализ.*данн/u),
  theme("Резюме специалиста", /\bcv\b|\bresume\b|резюме.*(?:работ|ваканси)/u),
  theme("Краткий пересказ", /summari[sz]|\bsummary\b|пересказ|кратк\p{L}* излож/u),
  theme("Письмо клиенту", /email|e.mail|письмо/u),
  theme("Сценарий ролика", /\bscript\b|сценарий/u, /video|reels|ролик|видео/u),
  theme("Кинематографичное видео", /\bvideo\b|animation|видео|анимаци/u)
];

const englishTitles: Record<string, string> = {
  "Портрет у бильярда": "Billiards Portrait",
  "Красная дорожка": "Red Carpet",
  "Китайская стена": "Great Wall",
  "Египетские пирамиды": "Egyptian Pyramids",
  "Зимний Куршевель": "Winter Courchevel",
  "Мальдивский отдых": "Maldives Escape",
  "Ночной Дубай": "Dubai Nights",
  "Венецианское кафе": "Venetian Cafe",
  "Парижский шопинг": "Paris Shopping",
  "Мандариновый сад": "Tangerine Orchard",
  "Маковое поле": "Poppy Field",
  "Пшеничное поле": "Wheat Field",
  "Конный клуб": "Equestrian Club",
  "Портрет с лошадью": "Horse Portrait",
  "Портрет с драконом": "Dragon Portrait",
  "Жемчужная ванна": "Pearl Bath",
  "Цветочная буря": "Flower Storm",
  "Белые цветы": "White Blossoms",
  "Мыльные пузыри": "Soap Bubbles",
  "Цифровой тоннель": "Digital Tunnel",
  "Неоновое движение": "Neon Motion",
  "Человек среди движения": "Crowd Motion Portrait",
  "Портрет в наушниках": "Headphones Portrait",
  "Взлёт над моделью": "Low Flying Aircraft",
  "Частный самолёт": "Private Jet",
  "Вертолётная площадка": "Helicopter Pad",
  "Аэропортный стиль": "Airport Style",
  "Портрет в метро": "Subway Portrait",
  "Футбольный стадион": "Football Stadium",
  "Ночная ярмарка": "Night Carnival",
  "Испанская вечеринка": "Spanish Party",
  "Ночной скутер": "Night Scooter",
  "Летний скутер": "Summer Scooter",
  "Жёлтая Феррари": "Yellow Ferrari",
  "Красная Феррари": "Red Ferrari",
  "Розовый Порше": "Pink Porsche",
  "Роскошный Бентли": "Luxury Bentley",
  "Портрет у Гелендвагена": "G Class Portrait",
  "Салон Роллс-Ройса": "Rolls-Royce Interior",
  "Ночной спорткар": "Night Supercar",
  "Автомобильный портрет": "Luxury Car Portrait",
  "Закат на яхте": "Yacht Sunset",
  "Морская яхта": "Ocean Yacht",
  "Термальный бассейн": "Thermal Pool",
  "Зимнее шале": "Winter Chalet",
  "Осеннее озеро": "Autumn Lake",
  "Портрет на пирсе": "Pier Portrait",
  "Портрет на дороге": "Road Portrait",
  "Тропический отдых": "Tropical Escape",
  "Прогулка на закате": "Sunset Walk",
  "Пляжный шезлонг": "Beach Lounger",
  "Морской закат": "Ocean Sunset",
  "Пляжный портрет": "Beach Portrait",
  "Прогулка по пустыне": "Desert Walk",
  "Галерейный вечер": "Gallery Evening",
  "Ювелирный бутик": "Jewelry Boutique",
  "Клубная библиотека": "Club Library",
  "Мраморная лестница": "Marble Staircase",
  "Дизайнерская примерочная": "Designer Fitting Room",
  "Утро в пентхаусе": "Penthouse Morning",
  "Роскошный пентхаус": "Luxury Penthouse",
  "Селфи в зеркале": "Mirror Selfie",
  "Вечернее селфи": "Evening Selfie",
  "Летнее селфи": "Summer Selfie",
  "Солнечная крыша": "Sunlit Rooftop",
  "Портрет на крыше": "Rooftop Portrait",
  "Городской балкон": "City Balcony",
  "Меховой глянец": "Fur Editorial",
  "Уютный портрет": "Cozy Portrait",
  "Портрет у окна": "Window Portrait",
  "Портрет на диване": "Sofa Portrait",
  "Красное кресло": "Red Armchair",
  "Зимний глянец": "Winter Editorial",
  "Городской ракурс": "Urban Perspective",
  "Реклама напитка": "Beverage Campaign",
  "Парящая косметика": "Floating Cosmetics",
  "Реклама косметики": "Cosmetics Campaign",
  "Модная карикатура": "Fashion Caricature",
  "Аниме скетчбук": "Anime Sketchbook",
  "Рисованный скетчбук": "Illustrated Sketchbook",
  "Аниме персонаж": "Anime Character",
  "Серебряный футуризм": "Silver Futurism",
  "Студийный портрет": "Studio Portrait",
  "Уличный стиль": "Street Style",
  "Бьюти портрет": "Beauty Portrait",
  "Модный портрет": "Fashion Portrait",
  "Телеграм бот": "Telegram Bot",
  "Лендинг продукта": "Product Landing",
  "Интерфейс приложения": "App Interface",
  "Дизайн логотипа": "Logo Design",
  "Фирменный стиль": "Brand Identity",
  "Рекламная кампания": "Marketing Campaign",
  "План путешествия": "Travel Plan",
  "План тренировок": "Workout Plan",
  "План питания": "Meal Plan",
  "Анализ данных": "Data Analysis",
  "Резюме специалиста": "Professional Resume",
  "Краткий пересказ": "Concise Summary",
  "Письмо клиенту": "Client Email",
  "Сценарий ролика": "Video Script",
  "Кинематографичное видео": "Cinematic Video"
};

export type PromptLanguage = "ru" | "en" | "other";

const brands = new Set("telegram bot react cursor chatgpt openai midjourney flux dalle photoshop pinterest instagram youtube tiktok ferrari porsche bentley rolls royce courchevel dubai giza nike adidas apple samsung".split(" "));
const englishWords = new Set("a an the and or of to for from with without in on at by as is are be my your this that it its their into over under use using create generate make write draw act build preserve keep image photo reference identity face same person woman man model portrait scene light lighting cinematic realistic studio beach sea yacht sunset winter night summer morning background view style design professional data beautiful crystal cave forest".split(" "));
const foreignWords = new Set("un une des du avec pour dans sur les le et au aux cette ce crée creer créer el la los las del con para una unos unas crea crear sin como que por der die das ein eine und mit für auf ohne dieser diese erstelle erstellen il lo gli per della delle degli crea creare um uma os as com sem criar crie não".split(" "));
const fallbackStopWords = new Set((
  "a an the and or of to for from with without in on at by as is are be my your this that it its their into over under use using create generate make write draw act build please " +
  "и в во на с со для из от к ко у о об по под над а но или это этот эта эти мой моя мое моё мои твой свой его ее её их как чтобы используй используйте создай создайте сделай сделайте напиши напишите нарисуй сгенерируй пожалуйста " +
  [...foreignWords].join(" ")
).split(/\s+/u));

function meaningfulText(content: string): string {
  return content.normalize("NFKC").toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/(?:^|\n)\s*(?:negative(?:\s+prompt)?|негативн\p{L}*(?:\s+промпт)?)\s*[:：][\s\S]*$/gu, " ")
    .split(/\n+|(?<=[.!?])\s+/u)
    .map((line) => line.replace(/^\s*[-*#>]+\s*/u, ""))
    .filter((line) => !/^\s*(?:negative\b|no\b|do not\b|don't\b|avoid\b|не\s|без\s|исключи|негативн)/u.test(line))
    .map((line) => line
      .replace(/\b(?:no|without|avoid|do not|don't)\s+[^.!?]*/gu, " ")
      .replace(/(?:^|[\s,;])(?:не|без|исключая)\s+[^.!?]*/gu, " "))
    .join("\n");
}

function languageOfText(text: string): PromptLanguage {
  if (!text.trim()) return "ru";
  const sentences = [...new Set(text.split(/\n+|(?<=[.!?])\s+/u).map(line => line.trim()).filter(Boolean))];
  const substantive = sentences.filter(line => !/^\s*(?:use|using)\b.*\b(?:reference\s+(?:photo|image)|uploaded\s+(?:photo|image))\b|\b(?:preserve|maintain|keep)\b.*\b(?:identity|facial|same person|face)\b|^\s*(?:используй|используйте)\s.*(?:референс|исходн|фото)|(?:сохрани|сохраните)\p{L}*\s.*(?:лиц|личност|идентичност)/u.test(line));
  const words = (substantive.length ? substantive : sentences).join(" ").match(/\p{L}+(?:['’\-]\p{L}+)*/gu) ?? [];
  const counts = new Map<string, number>();
  let russian = 0, english = 0, englishSignals = 0, foreign = 0, otherScript = 0, foreignCyrillic = 0;
  for (const word of words) {
    const count = counts.get(word) ?? 0;
    if (count >= 2 || brands.has(word)) continue;
    counts.set(word, count + 1);
    if (/^[\p{Script=Cyrillic}]+$/u.test(word)) {
      if (/[іїєґўђјљњћџќѓ]/u.test(word)) { otherScript++; foreignCyrillic++; }
      else russian++;
    } else if (/^[a-z]+(?:['’\-][a-z]+)*$/u.test(word)) {
      english++;
      if (englishWords.has(word)) englishSignals++;
      if (foreignWords.has(word)) foreign++;
    } else {
      otherScript++;
      if (/[à-ž]/u.test(word)) foreign++;
    }
  }
  if (otherScript > russian && otherScript > english) return "other";
  if (foreignCyrillic > 0 && foreignCyrillic * 4 >= russian && russian >= english) return "other";
  if (russian > 0 && russian >= english) return "ru";
  if (foreign > englishSignals) return "other";
  return english > 0 ? "en" : "other";
}

export function detectPromptLanguage(content: string): PromptLanguage {
  return languageOfText(meaningfulText(content));
}

function fallbackTitle(text: string): string {
  const sourceWords = text.match(/\p{L}[\p{L}\p{M}\p{N}]*(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu) ?? [];
  const uniqueWords = [...new Set(sourceWords)];
  let words = uniqueWords.filter(word => !fallbackStopWords.has(word) && word.length > 1).slice(0, 3);
  if (words.length < 2) words = uniqueWords.filter(word => !fallbackStopWords.has(word)).slice(0, 3);
  // A single source word or a language without spaces cannot supply two natural
  // words. Keep its own script instead of inserting a title in another language.
  const title = words.length ? words.join(" ") : text.trim();
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function buildShortPromptTitle(content: string): string {
  if (!content.trim()) return "Новый промпт";
  const text = meaningfulText(content);
  if (!text.trim()) {
    const source = content.normalize("NFKC").toLowerCase().replace(/<[^>]*>/g, " ");
    if (!source.trim()) return "Новый промпт";
    const language = languageOfText(source);
    return language === "ru" ? "Ограничения изображения" : language === "en" ? "Image Constraints" : fallbackTitle(source);
  }
  const language = languageOfText(text);
  // Rules are ordered: distinctive subjects and settings precede generic styles.
  if (language !== "other") {
    const scene = text.replace(/\n/g, " ");
    for (const entry of themes) {
      if (entry.clues.every((clue) => clue.test(scene))) {
        return language === "ru" ? entry.title : englishTitles[entry.title];
      }
    }
  }
  return fallbackTitle(text);
}

export function isShortPromptTitle(value?: string | null): boolean {
  if (!value?.trim() || /[.!?…\n]/u.test(value)) return false;
  if (/^(?:use|create|generate|make|write|draw|act|используй|создай|сделай|напиши|нарисуй|сгенерируй)(?:\s|$)/iu.test(value.trim())) return false;
  const words = value.trim().split(/\s+/u);
  return words.length >= 2 && words.length <= 3 && words.every((word) => /[\p{L}\p{N}]/u.test(word));
}

export function resolvePromptTitle(prompt: { title?: string | null; content: string; contentIsExcerpt?: boolean }): string {
  const title = prompt.title?.trim() ?? "";
  if (!isShortPromptTitle(title)) {
    const normalizedTitle = title.normalize("NFKC").toLowerCase().replace(/[.…]+$/u, "").replace(/\s+/gu, " ");
    const looksLikeExcerpt = prompt.content.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").startsWith(normalizedTitle);
    const looksLikeInstruction = /^(?:use|create|generate|make|write|draw|act|используй|создай|сделай|напиши|нарисуй|сгенерируй)(?:\s|$)/iu.test(title);
    if (title && !looksLikeExcerpt && !looksLikeInstruction && !/[\n]/u.test(title)) return title;
    return buildShortPromptTitle(prompt.content);
  }
  // A card excerpt may contain only the reference-photo introduction. The API has
  // already resolved its saved title from the complete prompt, so keep that result.
  if (prompt.contentIsExcerpt) return title;
  const normalizedTitle = title.normalize("NFKC").toLowerCase();
  const knownTheme = themes.find(entry => entry.title.toLowerCase() === normalizedTitle || englishTitles[entry.title].toLowerCase() === normalizedTitle);
  if (knownTheme) {
    const language = detectPromptLanguage(prompt.content);
    if (language === "ru") return knownTheme.title;
    if (language === "en") return englishTitles[knownTheme.title];
    return buildShortPromptTitle(prompt.content);
  }
  if (normalizedTitle === "новый промпт" || normalizedTitle === "new prompt") return buildShortPromptTitle(prompt.content);
  return title;
}
