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

function meaningfulText(content: string): string {
  return content.normalize("NFKC").toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .split(/\n+|(?<=[.!?])\s+/u)
    .filter((line) => !/^\s*(?:negative\b|no\b|do not\b|don't\b|avoid\b|не\s|без\s|исключи|негативн)/u.test(line))
    .map((line) => line.replace(/(?:^|[,;])\s*(?:no|without|avoid|не|без)\s+[^,;.!?]*/gu, " "))
    .join(" ");
}

export function buildShortPromptTitle(content: string): string {
  const text = meaningfulText(content);
  if (!text.trim()) return "Новый промпт";
  // Rules are ordered: distinctive subjects and settings precede generic styles.
  for (const entry of themes) {
    if (entry.clues.every((clue) => clue.test(text))) return entry.title;
  }
  return "Новый промпт";
}

export function isShortPromptTitle(value?: string | null): boolean {
  if (!value?.trim() || /[.!?…\n]/u.test(value)) return false;
  if (/^(?:use|create|generate|make|write|draw|act|используй|создай|сделай|напиши|нарисуй|сгенерируй)(?:\s|$)/iu.test(value.trim())) return false;
  const words = value.trim().split(/\s+/u);
  return words.length >= 2 && words.length <= 3 && words.every((word) => /[\p{L}\p{N}]/u.test(word));
}

export function resolvePromptTitle(prompt: { title?: string | null; content: string }): string {
  return isShortPromptTitle(prompt.title) ? prompt.title!.trim() : buildShortPromptTitle(prompt.content);
}
