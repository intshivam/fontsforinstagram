/* ===========================
   DOM shortcuts
   =========================== */
   const byId = id => document.getElementById(id);
   const stylesEl = byId('styles');
   const dock = byId('dock');
   const micBtn = byId('micBtn');
   const inputEl = byId('source');
   const catBar = byId('catBar');
   
   /* placeholder text to render in each style when input is empty */
   const PLACEHOLDER = 'Type something…';
   
   /* ----------------------
      0) Favorites persistence
      ---------------------- */
   const LS_KEY = 'likedStylesV1';
   function loadLikedIds(){ try { return new Set(JSON.parse(localStorage.getItem(LS_KEY)) || []); } catch { return new Set(); } }
   function saveLikedIds(set){ localStorage.setItem(LS_KEY, JSON.stringify(Array.from(set))); }
   const likedIds = loadLikedIds();
   
   /* ----------------------
      1) STYLE ENGINE
      ---------------------- */
   
   /* Grapheme-aware splitter so sequences like a̲ (base + combining mark) stay together */
   const COMBINING_RE = /[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/;
   function splitGraphemes(str){
     const cps = Array.from(str);
     const out = [];
     for (let i = 0; i < cps.length; i++) {
       let cluster = cps[i];
       while (i + 1 < cps.length && COMBINING_RE.test(cps[i + 1])) cluster += cps[++i];
       out.push(cluster);
     }
     return out;
   }
   
   /* Try to detect strings like "a★b★c★...z★" (constant separator between letters). */
   function detectLetterSeparatorPattern(dstLowerG) {
     const letters = Array.from('abcdefghijklmnopqrstuvwxyz');
     // Expect pattern: [a, SEP, b, SEP, c, SEP, ... , z, (SEP optional)]
     if (dstLowerG.length < 51) return null; // minimally a,sep,b,sep,...,y,sep,z
     if (dstLowerG[0] !== 'a') return null;
   
     let sep = null;
     for (let i = 0; i < 26; i++) {
       const idx = i * 2;
       if (dstLowerG[idx] !== letters[i]) return null;
       if (i < 25) {
         const next = dstLowerG[idx + 1];
         if (sep == null) sep = next;
         else if (next !== sep) return null;
       }
     }
     // Allow optional trailing sep after 'z'
     return sep || null;
   }
   
   function makeMap(dst) {
     const lowerSrc = Array.from('abcdefghijklmnopqrstuvwxyz');
     const upperSrc = Array.from('abcdefghijklmnopqrstuvwxyz'.toUpperCase());
   
     const dstLowerG = splitGraphemes(dst);
   
     // 1) Perfect 26-grapheme mapping (normal case)
     if (dstLowerG.length === 26) {
       const dstUpperG = splitGraphemes(dst.toUpperCase());
       const m = new Map();
       for (let i = 0; i < 26; i++) m.set(lowerSrc[i], dstLowerG[i] || lowerSrc[i]);
       for (let i = 0; i < 26; i++) m.set(upperSrc[i], dstUpperG[i] || upperSrc[i]);
       return m;
     }
   
     // 2) Decorator pattern like a★b★c★...z★  -> map 'a' -> 'a★', 'A' -> 'A★'
     const sep = detectLetterSeparatorPattern(dstLowerG);
     if (sep) {
       const m = new Map();
       for (let i = 0; i < 26; i++) {
         m.set(lowerSrc[i], lowerSrc[i] + sep);
         m.set(upperSrc[i], upperSrc[i] + sep);
       }
       return m;
     }
   
     // 3) Fallback: try to best-effort map first 26 graphemes, leave others as-is
     const m = new Map();
     for (let i = 0; i < 26; i++) m.set(lowerSrc[i], dstLowerG[i] || lowerSrc[i]);
     const dstUpperG = splitGraphemes(dst.toUpperCase());
     for (let i = 0; i < 26; i++) m.set(upperSrc[i], dstUpperG[i] || upperSrc[i]);
     return m;
   }
   
   function stylize(s, map) { return Array.from(s).map(ch => map.get(ch) ?? ch).join(''); }
   function transformWithTable(s, table) { return Array.from(s).map(ch => table.get(ch) ?? ch).join(''); }
   
   const maps = {
     bold:         makeMap('𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳'),
     italic:       makeMap('𝑎𝑏𝑐𝑑𝑒𝑓𝑔ℎ𝑖𝑗𝑘𝑙𝑚𝑛𝑜𝑝𝑞𝑟𝑠𝑡𝑢𝑣𝑤𝑥𝑦𝑧'),
     boldItalic:   makeMap('𝒂𝒃𝒄𝒅𝒆𝒇𝒈𝒉𝒊𝒋𝒌𝒍𝒎𝒏𝒐𝒑𝒒𝒓𝒔𝒕𝒖𝒗𝒘𝒙𝒚𝒛'),
     monospace:    makeMap('𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣'),
     doublestruck: makeMap('𝕒𝕓𝕔𝕕𝕖𝕗𝕘𝕙𝕚𝕛𝕜𝕝𝕞𝕟𝕠𝕡𝕢𝕣𝕤𝕥𝕦𝕧𝕨𝕩𝕪𝕫'),
     medieval:     makeMap('𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷'),
     smallcaps:    makeMap('abcdefghijklmnopqrstuvwxyz'.toUpperCase()),
     fullwidth:    makeMap('ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ'),
     circled:      makeMap('ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ'),
     wide:         makeMap('ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ'.toLowerCase()),
     asian:        makeMap('卂乃匚刀乇下厶卄丨ﾌҜㄥ爪几ㄖ卩Ɋ尺丂ㄒㄩᐯ山乂ㄚ乙'),
     russian:      makeMap('абЦдефгнийклмнопрягстувшхыз'.toLowerCase().replace('ц','ц')),
     squared:      makeMap('🄰🄱🄲🄳🄴🄵🄶🄷🄸🄹🄺🄻🄼🄽🄾🄿🅀🅁🅂🅃🅄🅅🅆🅇🅈🅉'.toLowerCase()),
     blackCircled: makeMap('🅐🅑🅒🅓🅔🅕🅖🅗🅘🅙🅚🅛🅜🅝🅞🅟🅠🅡🅢🅣🅤🅥🅦🅧🅨🅩'),
     inverted:     makeMap('ɐqɔpǝɟƃɥᴉɾʞןɯuodbɹsʇnʌʍxʎz'),
     subscript:    makeMap('ₐbcdₑfgₕᵢⱼklₘₙₒₚqᵣₛₜᵤᵥwₓyz'),
     superscript:  makeMap('ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ'),
     underline:    makeMap('a̲b̲c̲d̲e̲f̲g̲h̲i̲j̲k̲l̲m̲n̲o̲p̲q̲r̲s̲t̲u̲v̲w̲x̲y̲z̲'),
     strike:       makeMap('a̶b̶c̶d̶e̶f̶g̶h̶i̶j̶k̶l̶m̶n̶o̶p̶q̶r̶s̶t̶u̶v̶w̶x̶y̶z̶'),
     tiny:         makeMap('ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ'),
     parenthesized: makeMap('⒜⒝⒞⒟⒠⒡⒢⒣⒤⒥⒦⒧⒨⒩⒪⒫⒬⒭⒮⒯⒰⒱⒲⒳⒴⒵'),
     dotted:        makeMap('ạḅċḍėḟġḣịĵḳḷṃṇọṗɋṛṣṭụṿẇẋẏẓ'),
     doublecircled: makeMap('🅐🅑🅒🅓🅔🅕🅖🅗🅘🅙🅚🅛🅜🅝🅞🅟🅠🅡🅢🅣🅤🅥🅦🅧🅨🅩'),
     frakturBold:   makeMap('𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟'),
     script:        makeMap('𝒶𝒷𝒸𝒹ℯ𝒻ℊ𝒽𝒾𝒿𝓀𝓁𝓂𝓃ℴ𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏'),
     scriptBold:    makeMap('𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃'),
     squaredAlt:    makeMap('🅰🅱🅲🅳🅴🅵🅶🅷🅸🅹🅺🅻🅼🅽🅾🅿🆀🆁🆂🆃🆄🆅🆆🆇🆈🆉'.toLowerCase()),
     bubble:        makeMap('ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ'),
     reversed:      makeMap('ɒdɔbɘʇϱʜiįʞʅwuodbɿƨʇnʌʍxʎz'),
     tinyCaps:      makeMap('ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘᴏʀsᴛᴜᴠᴡxʏᴢ'),
   
     /* These now work as intended: letter + separator */
     slash:         makeMap('a̷b̷c̷d̷e̷f̷g̷h̷i̷j̷k̷l̷m̷n̷o̷p̷q̷r̷s̷t̷u̷v̷w̷x̷y̷z̷'),
     waves:         makeMap('a̴b̴c̴d̴e̴f̴g̴h̴i̴j̴k̴l̴m̴n̴o̴p̴q̴r̴s̴t̴u̴v̴w̴x̴y̴z̴'),
     hearts:        makeMap('a♥b♥c♥d♥e♥f♥g♥h♥i♥j♥k♥l♥m♥n♥o♥p♥q♥r♥s♥t♥u♥v♥w♥x♥y♥z♥'),
     stars:         makeMap('a★b★c★d★e★f★g★h★i★j★k★l★m★n★o★p★q★r★s★t★u★v★w★x★y★z★')
   };
   
   const homoPairs = { a:'а', e:'е', o:'о', p:'ρ', c:'с', y:'у', x:'х', h:'һ', k:'κ', b:'ь', i:'і', j:'ј', s:'ѕ', d:'ԁ', m:'ｍ', n:'ո', r:'г', t:'τ', u:'ս', v:'ѵ', w:'ѡ', f:'ғ', g:'ɢ', q:'զ' };
   const mixedTable = new Map();
   for (const ch of Array.from('abcdefghijklmnopqrstuvwxyz')) {
     mixedTable.set(ch, homoPairs[ch] || ch);
     mixedTable.set(ch.toUpperCase(), (homoPairs[ch] || ch).toUpperCase());
   }
   
   const BASE_STYLES = [
     { name: 'Bold',          fn: s => stylize(s, maps.bold) },
     { name: 'Italic',        fn: s => stylize(s, maps.italic) },
     { name: 'Bold Italic',   fn: s => stylize(s, maps.boldItalic) },
     { name: 'Monospace',     fn: s => stylize(s, maps.monospace) },
     { name: 'Double-Struck', fn: s => stylize(s, maps.doublestruck) },
     { name: 'Medieval',      fn: s => stylize(s, maps.medieval) },
     { name: 'Small Caps',    fn: s => stylize(s.toLowerCase(), maps.smallcaps) },
     { name: 'Full Width',    fn: s => stylize(s, maps.fullwidth) },
     { name: 'Circled',       fn: s => stylize(s, maps.circled) },
     { name: 'Wide',          fn: s => stylize(s, maps.wide) },
     { name: 'Mixed Script',  fn: s => transformWithTable(s, mixedTable) },
     { name: 'Spaced',        fn: s => Array.from(s).join(' ') },
     { name: 'Asian',        fn: s => stylize(s, maps.asian) },
     { name: 'Russian',      fn: s => stylize(s, maps.russian) },
     { name: 'Squared',      fn: s => stylize(s, maps.squared) },
     { name: 'Black Circled', fn: s => stylize(s, maps.blackCircled) },
     { name: 'Inverted',      fn: s => stylize(s, maps.inverted) },
     { name: 'Subscript',     fn: s => stylize(s, maps.subscript) },
     { name: 'Superscript',   fn: s => stylize(s, maps.superscript) },
     { name: 'Underline',     fn: s => stylize(s, maps.underline) },
     { name: 'Strike',        fn: s => stylize(s, maps.strike) },
     { name: 'Tiny',          fn: s => stylize(s, maps.tiny) },
     { name: 'Parenthesized', fn: s => stylize(s, maps.parenthesized) },
     { name: 'Dotted',        fn: s => stylize(s, maps.dotted) },
     { name: 'Double Circled', fn: s => stylize(s, maps.doublecircled) },
     { name: 'Fraktur Bold',   fn: s => stylize(s, maps.frakturBold) },
     { name: 'Script',        fn: s => stylize(s, maps.script) },
     { name: 'Script Bold',   fn: s => stylize(s, maps.scriptBold) },
     { name: 'Squared Alt',   fn: s => stylize(s, maps.squaredAlt) },
     { name: 'Bubble',        fn: s => stylize(s, maps.bubble) },
     { name: 'Reversed',      fn: s => stylize(s, maps.reversed) },
     { name: 'Tiny Caps',     fn: s => stylize(s, maps.tinyCaps) },
     { name: 'Slash',         fn: s => stylize(s, maps.slash) },
     { name: 'Waves',         fn: s => stylize(s, maps.waves) },
     { name: 'Hearts',        fn: s => stylize(s, maps.hearts) },
     { name: 'Stars',         fn: s => stylize(s, maps.stars) }
   ];
   
   /* ----------------------
      2) WRAPPER FACTORY
      ---------------------- */
   const frames = {
     KAOMOJI: [
       ['(っ◔◡◔)っ ', ' っ'], ['(づ｡◕‿‿◕｡)づ ', ' (づ｡◕‿‿◕｡)づ'],
       ['(◍•ᴗ•◍)❤ ', ' ❤(◍•ᴗ•◍)'], ['(＾▽＾) ', ' (＾▽＾)'],
       ['(´｡• ᵕ •｡`) ', ' (´｡• ᵕ •｡`)'], ['(★‿★) ', ' (★‿★)'],
       ['(≧◡≦) ♡ ', ' ♡ (≧◡≦)'], ['(˶˃ ᵕ ˂˶) ', ' (˶˃ ᵕ ˂˶)'],
       ['(๑˃̵ᴗ˂˵)و ', ' ٩(ˊᗜˋ*)و']
     ],
     LENNY: [
       ['( ͡° ͜ʖ ͡°) ', ' ( ͡° ͜ʖ ͡°)'],
       ['( ͡~ ͜ʖ ͡°) ', ' ( ͡° ͜ʖ ͡~)'],
       ['( ͡◐ ͜ʖ ͡◐) ', ' ( ͡◐ ͜ʖ ͡◐)'],
       ['( ͠° ͟ʖ ͡°) ', ' ( ͠° ͟ʖ ͡°)'],
       ['( ͡ಠ ͜ʖ ͡ಠ) ', ' ( ͡ಠ ͜ʖ ͡ಠ)'],
       ['(ง ͠° ͟ل͜ ͡°)ง ', ' ᕦ( ͡° ͜ʖ ͡°)ᕤ'],
       ['( ͡• ͜ʖ ͡•) ', ' ( ͡• ͜ʖ ͡•)']
     ],
     EMOJI: [
       ['✨ ', ' ✨'], ['🌸 ', ' 🌸'], ['💫 ', ' 💫'], ['🔥 ', ' 🔥'],
       ['🌊 ', ' 🌊'], ['🌈 ', ' 🌈'], ['⭐ ', ' ⭐'], ['💖 ', ' 💖'],
       ['🪐 ', ' 🪐'], ['⚡ ', ' ⚡'], ['🌟 ', ' 🌟'], ['🎯 ', ' 🎯'],
       ['🪽 ', ' 🪽'], ['🧊 ', ' 🧊'], ['🌙 ', ' 🌙'], ['🍀 ', ' 🍀'],
       ['🔫 ', ' 🔫'], ['💣 ', ' 💣'], ['🗡️ ', ' 🗡️'], ['⚔️ ', ' ⚔️'],
       ['🏹 ', ' 🏹'], ['🛡️ ', ' 🛡️'], ['🚬 ', ' 🚬'], ['💎 ', ' 💎'],
       ['👑 ', ' 👑'], ['👑🏻 ', ' 👑🏻'], ['👑🏾 ', ' 👑🏾'], ['👑🏿 ', ' 👑🏿'],
       ['🤴 ', ' 🤴'], ['👸 ', ' 👸'], ['🪖 ', ' 🪖'], ['🎖️ ', ' 🎖️'],
       ['🏆 ', ' 🏆'], ['🥇 ', ' 🥇'], ['🥂 ', ' 🥂'], ['🍾 ', ' 🍾'],
       ['💵 ', ' 💵'], ['💰 ', ' 💰'], ['🤑 ', ' 🤑'], ['💳 ', ' 💳'],
       ['🧨 ', ' 🧨'], ['🎆 ', ' 🎆'], ['🎇 ', ' 🎇'], ['🔥 ', ' 🔥'],
       ['🚀 ', ' 🚀'], ['🛸 ', ' 🛸'], ['👨‍🚀 ', ' 👨‍🚀'], ['👩‍🚀 ', ' 👩‍🚀'],
       ['🛰️ ', ' 🛰️'], ['🌌 ', ' 🌌'], ['🪐 ', ' 🪐'], ['☄️ ', ' ☄️'],
       ['🌠 ', ' 🌠'], ['🌙 ', ' 🌙'], ['🪂 ', ' 🪂'], ['🛸 ', ' 🛸'],
       ['😎 ', ' 😎'], ['🕶️ ', ' 🕶️'], ['🧢 ', ' 🧢'], ['🎩 ', ' 🎩'],
       ['🥷 ', ' 🥷'], ['🤠 ', ' 🤠'], ['🧥 ', ' 🧥'], ['👕 ', ' 👕'],
       ['👟 ', ' 👟'], ['🥾 ', ' 🥾'], ['👞 ', ' 👞'], ['💼 ', ' 💼'],
       ['🖤 ', ' 🖤'], ['💀 ', ' 💀'], ['☠️ ', ' ☠️'], ['👹 ', ' 👹'],
       ['👺 ', ' 👺'], ['🧛 ', ' 🧛'], ['🧟 ', ' 🧟'], ['🦾 ', ' 🦾'],
       ['🔮 ', ' 🔮'], ['⚡ ', ' ⚡'], ['⚔️ ', ' ⚔️'], ['🛡️ ', ' 🛡️'],
       ['📡 ', ' 📡'], ['🔭 ', ' 🔭'], ['🕹️ ', ' 🕹️'], ['🎮 ', ' 🎮'],
       ['🎧 ', ' 🎧'], ['🎤 ', ' 🎤'], ['🎸 ', ' 🎸'], ['🥁 ', ' 🥁'],
       ['🎺 ', ' 🎺'], ['🎷 ', ' 🎷'], ['💯 ', ' 💯'], ['✅ ', ' ✅'],
       ['♟️ ', ' ♟️'], ['♞ ', ' ♞'], ['🃏 ', ' 🃏'], ['🎴 ', ' 🎴'],
       ['🧊 ', ' 🧊'], ['❄️ ', ' ❄️'], ['☃️ ', ' ☃️'], ['🌨️ ', ' 🌨️'],
       ['🌪️ ', ' 🌪️'], ['🌀 ', ' 🌀'], ['🌊 ', ' 🌊'], ['🌫️ ', ' 🌫️'],
       ['🧨 ', ' 🧨'], ['🎯 ', ' 🎯'], ['🏹 ', ' 🏹'], ['🔪 ', ' 🔪'],
       ['🪓 ', ' 🪓'], ['🔧 ', ' 🔧'], ['⚙️ ', ' ⚙️'], ['🔩 ', ' 🔩']
     ],
     BOX: [
       ['【 ', ' 】'], ['『 ', ' 』'], ['「 ', ' 」'], ['〔 ', ' 〕'],
       ['《 ', ' 》'], ['⟦ ', ' ⟧'], ['⟨ ', ' ⟩'], ['〖 ', ' 〗'],
       ['⟪ ', ' ⟫'], ['⟮ ', ' ⟯'], ['❪ ', ' ❫'], ['❲ ', ' ❳'], ['❴ ', ' ❵'], ['❬ ', ' ❭'],
       ['⦃ ', ' ⦄'], ['⦅ ', ' ⦆'], ['⦇ ', ' ⦈'], ['⦉ ', ' ⦊'],
       ['⦋ ', ' ⦌'], ['⦍ ', ' ⦎'], ['⦏ ', ' ⦐'], ['⦑ ', ' ⦒'],
       ['⦓ ', ' ⦔'], ['⦕ ', ' ⦖'], ['⧼ ', ' ⧽'], ['⸢ ', ' ⸣'],
       ['⸤ ', ' ⸥'], ['﹙ ', ' ﹚'], ['﹛ ', ' ﹜'], ['﹝ ', ' ﹞'],
       ['（ ', ' ）'], ['［ ', ' ］'], ['｛ ', ' ｝'], ['｟ ', ' ｠'],
       ['❮ ', ' ❯'], ['‹ ', ' ›'], ['« ', ' »'], ['„ ', ' “'],
       ['⟅ ', ' ⟆'], ['⟦ ', ' ⟧'], ['⟨ ', ' ⟩'], ['⟪ ', ' ⟫'],
       ['⟬ ', ' ⟭'], ['⟮ ', ' ⟯'], ['⟴ ', ' ⟵'], ['⟶ ', ' ⟷'],
       ['⸨ ', ' ⸩'], ['⦗ ', ' ⦘'], ['⸦ ', ' ⸧'], ['⸨ ', ' ⸩'],
       ['⌈ ', ' ⌉'], ['⌊ ', ' ⌋'], ['⦋ ', ' ⦌'], ['⦇ ', ' ⦈']
     ],
     LINES : [
       ['─═── ', ' ──═─'], ['━━ ', ' ━━'], ['╾━╤ ', ' ╤━╼'],
       ['╔═╗ ', ' ╚═╝'], ['▁▂▃▄▅▆▇ ', ' ▇▆▅▄▃▂▁'],
       ['·•° ', ' °•·'], ['•´¯`• ', ' •´¯`•'], ['✦ ', ' ✦'],
       ['⎯⎯ ', ' ⎯⎯'], ['⎯͟͟͞ ', ' ͟͟͞⎯'], ['⋆ ', ' ⋆'],
       ['· · · ', ' · · ·'], ['・‥… ', ' …‥・'],
       ['︻デ═一 ', ' 一═デ︻'],
       ['︻╦̵̵͇̿̿̿̿╤── ', ' ──╤̿̿̿̿̿̿╦̵̵͇︻'],
       ['▄︻デ══━一 ', ' 一━══デ︻▄'],
       ['(╯°□°）╯︵ ┻━┻ ', ' ┻━┻ ︵ ╯(°□°╯)'],
       ['☭═╦═☭ ', ' ☭═╦═☭'],
       ['✧╾━╤デ╦︻✧ ', ' ✧︻╦デ╤━╼✧'],
       ['︻┻═┳一 ', ' 一┳═┻︻'],
       ['╾━╤デ╦︻ ', ' ︻╦デ╤━╼'],
       ['︻╦╤─ ', ' ─╤╦︻'],
       ['⌬═─ ', ' ─═⌬'],
       ['✪═─ ', ' ─═✪'],
       ['︻⋆═━一 ', ' 一━═⋆︻']
     ],
     ORNATE: [
       ['꧁ ', ' ꧂'], ['꧁༒ ', ' ༒꧂'], ['◥꧁☆ ', ' ☆꧂◤'],
       ['✧‧˚ ', ' ˚‧✧'], ['✺ ', ' ✺'], ['✵ ', ' ✵'],
       ['✺✺ ', ' ✺✺'], ['✷ ', ' ✷'], ['✶ ', ' ✶'], ['✿ ', ' ✿'], ['❀ ', ' ❀'], ['❁ ', ' ❁'], ['✾ ', ' ✾'],
       ['❃ ', ' ❃'], ['❊ ', ' ❊'], ['❋ ', ' ❋'], ['✤ ', ' ✤'],
       ['✥ ', ' ✥'], ['✣ ', ' ✣'], ['✢ ', ' ✢'], ['✦ ', ' ✦'],
       ['✧ ', ' ✧'], ['✩ ', ' ✩'], ['✪ ', ' ✪'], ['✫ ', ' ✫'],
       ['✬ ', ' ✬'], ['✭ ', ' ✭'], ['✮ ', ' ✮'], ['✯ ', ' ✯'],
       ['❂ ', ' ❂'], ['❈ ', ' ❈'], ['❉ ', ' ❉'], ['✲ ', ' ✲'],
       ['✱ ', ' ✱'], ['✻ ', ' ✻'], ['✼ ', ' ✼'], ['✽ ', ' ✽'],
       ['❇ ', ' ❇'], ['❖ ', ' ❖'], ['✺✧ ', ' ✧✺'], ['✵✵ ', ' ✵✵'],
       ['✿✿ ', ' ✿✿'], ['❀❀ ', ' ❀❀'], ['✾✾ ', ' ✾✾'], ['✣✣ ', ' ✣✣'],
       ['✦✦ ', ' ✦✦'], ['✧✧ ', ' ✧✧'], ['✩✩ ', ' ✩✩'], ['✪✪ ', ' ✪✪'],
       ['✫✫ ', ' ✫✫'], ['✬✬ ', ' ✬✬'], ['✭✭ ', ' ✭✭'], ['✮✮ ', ' ✮✮'],
       ['✯✯ ', ' ✯✯'], ['❂❂ ', ' ❂❂'], ['❉❉ ', ' ❉❉'], ['❖❖ ', ' ❖❖'],
       ['ღ ', ' ღ'], ['♡ ', ' ♡'], ['♥ ', ' ♥'], ['❣ ', ' ❣'],
       ['❤ ', ' ❤'], ['💖 ', ' 💖'], ['❦ ', ' ❦'], ['❧ ', ' ❧'],
       ['✿✧ ', ' ✧✿'], ['❀✵ ', ' ✵❀'], ['✶♡ ', ' ♡✶'], ['✺❤ ', ' ❤✺'],
       ['⟡ ', ' ⟡'], ['✪★ ', ' ★✪'], ['✧✦ ', ' ✦✧'], ['✯☆ ', ' ☆✯'],
       ['✵✿ ', ' ✿✵'], ['❀✺ ', ' ✺❀'], ['✾✧ ', ' ✧✾'], ['✣✶ ', ' ✶✣'],
       ['❊❋ ', ' ❋❊'], ['✤✤ ', ' ✤✤'], ['✱✲ ', ' ✲✱'], ['✻✽ ', ' ✽✻'],
       ['❇❈ ', ' ❈❇'], ['❖✦ ', ' ✦❖'], ['✩ღ ', ' ღ✩'], ['✧❣ ', ' ❣✧'],
       ['꧁✧ ', ' ✧꧂'], ['꧁✦ ', ' ✦꧂'], ['꧁✯ ', ' ✯꧂'], ['꧁❀ ', ' ❀꧂'],
       ['꧁❤ ', ' ❤꧂'], ['꧁❖ ', ' ❖꧂'], ['꧁✺ ', ' ✺꧂'], ['꧁✵ ', ' ✵꧂'],
       ['◥✧ ', ' ✧◤'], ['◥✦ ', ' ✦◤'], ['◥✯ ', ' ✯◤'], ['◥❀ ', ' ❀◤'],
       ['◥❤ ', ' ❤◤'], ['◥❖ ', ' ❖◤'], ['◥✺ ', ' ✺◤'], ['◥✵ ', ' ✵◤']
     ],
     ARROWS: [
       ['➤ ', ' ➤'], ['➳ ', ' ➳'], ['➶ ', ' ➷'], ['⇢ ', ' ⇠'],
       ['⇨ ', ' ⇦'], ['↠ ', ' ↞'], ['➵ ', ' ➵'], ['⇶ ', ' ⇶'],
       ['⇵ ', ' ⇵'], ['⇴ ', ' ⇴'], ['➔ ', ' ➔'], ['➙ ', ' ➙'],
       ['➛ ', ' ➛'], ['➜ ', ' ➜'], ['➝ ', ' ➝'], ['➞ ', ' ➞'],
       ['➟ ', ' ➟'], ['➡ ', ' ➡'], ['⮕ ', ' ⮕'], ['➠ ', ' ➠'],
       ['➢ ', ' ➢'], ['➣ ', ' ➣'], ['➤ ', ' ➤'], ['➥ ', ' ➥'],
       ['➦ ', ' ➦'], ['➧ ', ' ➧'], ['➨ ', ' ➨'], ['➩ ', ' ➩'],
       ['➪ ', ' ➪'], ['➫ ', ' ➫'], ['➬ ', ' ➬'], ['➭ ', ' ➭'],
       ['➮ ', ' ➮'], ['➯ ', ' ➯'], ['➱ ', ' ➱'], ['➲ ', ' ➲'],
       ['➳ ', ' ➳'], ['➴ ', ' ➴'], ['➵ ', ' ➵'], ['➶ ', ' ➶'],
       ['➷ ', ' ➷'], ['➸ ', ' ➸'], ['➹ ', ' ➹'], ['➺ ', ' ➺'],
       ['➻ ', ' ➻'], ['➼ ', ' ➼'], ['➽ ', ' ➽'], ['➾ ', ' ➾'],
       ['⇀ ', ' ⇀'], ['↼ ', ' ↼'], ['⇁ ', ' ⇁'], ['⇃ ', ' ⇃'],
       ['⇂ ', ' ⇂'], ['↿ ', ' ↿'], ['⇄ ', ' ⇄'], ['⇆ ', ' ⇆'],
       ['⇅ ', ' ⇅'], ['⇵ ', ' ⇵'], ['⇈ ', ' ⇈'], ['⇊ ', ' ⇊'],
       ['⇉ ', ' ⇉'], ['⇇ ', ' ⇇'], ['⇋ ', ' ⇋'], ['⇌ ', ' ⇌'],
       ['⇎ ', ' ⇎'], ['⇏ ', ' ⇏'], ['↔ ', ' ↔'], ['↕ ', ' ↕'],
       ['↖ ', ' ↖'], ['↗ ', ' ↗'], ['↘ ', ' ↘'], ['↙ ', ' ↙'],
       ['↚ ', ' ↚'], ['↛ ', ' ↛'], ['↜ ', ' ↜'], ['↝ ', ' ↝'],
       ['↞ ', ' ↞'], ['↟ ', ' ↟'], ['↡ ', ' ↡'], ['↢ ', ' ↢'],
       ['↣ ', ' ↣'], ['↤ ', ' ↤'], ['↥ ', ' ↥'], ['↦ ', ' ↦'],
       ['↧ ', ' ↧'], ['↨ ', ' ↨'], ['↩ ', ' ↩'], ['↪ ', ' ↪'],
       ['↫ ', ' ↫'], ['↬ ', ' ↬'], ['↭ ', ' ↭'], ['↯ ', ' ↯'],
       ['↰ ', ' ↰'], ['↱ ', ' ↱'], ['↲ ', ' ↲'], ['↳ ', ' ↳'],
       ['↴ ', ' ↴'], ['↵ ', ' ↵']
     ],
     THEME: [
       ['⚔️ ', ' ⚔️'], ['♛ ', ' ♛'], ['♜ ', ' ♜'], ['♞ ', ' ♞'],
       ['☾ ', ' ☽'], ['✪ ', ' ✪'], ['✺ ', ' ✺'], ['✙ ', ' ✙'],
       ['♚ ', ' ♚'], ['♛ ', ' ♛'], ['♝ ', ' ♝'], ['♞ ', ' ♞'],
       ['♟ ', ' ♟'], ['♔ ', ' ♔'], ['♕ ', ' ♕'], ['♖ ', ' ♖'],
       ['♘ ', ' ♘'], ['♙ ', ' ♙'], ['♤ ', ' ♤'], ['♧ ', ' ♧'],
       ['♡ ', ' ♡'], ['♢ ', ' ♢'], ['♠ ', ' ♠'], ['♣ ', ' ♣'],
       ['♥ ', ' ♥'], ['♦ ', ' ♦'], ['⚜ ', ' ⚜'], ['☠ ', ' ☠'],
       ['☩ ', ' ☩'], ['☨ ', ' ☨'], ['✟ ', ' ✟'], ['✝ ', ' ✝'],
       ['☥ ', ' ☥'], ['✞ ', ' ✞'], ['✠ ', ' ✠'], ['✢ ', ' ✢'],
       ['✣ ', ' ✣'], ['✤ ', ' ✤'], ['✧ ', ' ✧'], ['✦ ', ' ✦'],
       ['✩ ', ' ✩'], ['✬ ', ' ✬'], ['✭ ', ' ✭'], ['✮ ', ' ✮'],
       ['✯ ', ' ✯'], ['✵ ', ' ✵'], ['✶ ', ' ✶'], ['✷ ', ' ✷'],
       ['✸ ', ' ✸'], ['✹ ', ' ✹'], ['✺ ', ' ✺'], ['✻ ', ' ✻'],
       ['✼ ', ' ✼'], ['✽ ', ' ✽'], ['✾ ', ' ✾'], ['✿ ', ' ✿'],
       ['❀ ', ' ❀'], ['❁ ', ' ❁'], ['❂ ', ' ❂'], ['❃ ', ' ❃'],
       ['❇ ', ' ❇'], ['❈ ', ' ❈'], ['❉ ', ' ❉'], ['❊ ', ' ❊'],
       ['❋ ', ' ❋'], ['✪ ', ' ✪'], ['✫ ', ' ✫'], ['✬ ', ' ✬'],
       ['✭ ', ' ✭'], ['✮ ', ' ✮'], ['✯ ', ' ✯'], ['❖ ', ' ❖'],
       ['✢ ', ' ✢'], ['✣ ', ' ✣'], ['⚝ ', ' ⚝'], ['⚞ ', ' ⚞'],
       ['⚟ ', ' ⚟'], ['☪ ', ' ☪'], ['☮ ', ' ☮'], ['☯ ', ' ☯'],
       ['☸ ', ' ☸'], ['卐 ', ' 卐'], ['卍 ', ' 卍'], ['♅ ', ' ♅'],
       ['♆ ', ' ♆'], ['♇ ', ' ♇'], ['⚒ ', ' ⚒'], ['⚑ ', ' ⚑'],
       ['⚐ ', ' ⚐'], ['⚓ ', ' ⚓'], ['⚡ ', ' ⚡'], ['☾ ', ' ☽']
     ]
   };
   
   const WRAPPERS = [];
   function addFrames(frameList, repeat = 1) {
     for (let r = 0; r < repeat; r++) for (const [L, R] of frameList) WRAPPERS.push(t => `${L}${t}${R}`);
   }
   addFrames(frames.KAOMOJI, 8);
   addFrames(frames.LENNY, 8);
   addFrames(frames.EMOJI, 10);
   addFrames(frames.BOX, 10);
   addFrames(frames.LINES, 10);
   addFrames(frames.ORNATE, 8);
   addFrames(frames.ARROWS, 8);
   addFrames(frames.THEME, 10);
   function pairWraps(listA, listB) {
     for (const [La, Ra] of listA) for (const [Lb, Rb] of listB) WRAPPERS.push(t => `${La}${Lb}${t}${Rb}${Ra}`);
   }
   pairWraps(frames.EMOJI, frames.BOX);
   pairWraps(frames.ORNATE, frames.LINES);
   pairWraps(frames.ARROWS, frames.EMOJI);
   pairWraps(frames.BOX, frames.LINES);
   WRAPPERS.push(t => t);
   
   /* ----------------------
      3) BUILD, DEDUPE, SHUFFLE
      ---------------------- */
   const PREVIEW_A = 'Shivam';
   const PREVIEW_B = 'instagram';
   
   function classifyCategories(str, baseName){
     const tags = new Set();
     const s = str;
     if (/[╾╤━]|デ|︻|╚|╔/.test(s)) tags.add('gun').add('weapons');
     if (/[♥❤💖♡]/.test(s)) tags.add('love').add('sexy');
     if (/[☆★✷✵✺✦⭐🌟✨💫]/.test(s)) tags.add('stars').add('decorated');
     if (/[(（][^)]*[)）]|(◍|◕|˶|＾|★‿★)/.test(s)) tags.add('kaomoji');
     if (/(͡°|͜|ʖ|ل)/.test(s)) tags.add('lenny').add('kaomoji');
     if (/[【『「〔《⟦⟨〖⟪⟮]/.test(s)) tags.add('boxed');
     if (/[—–━─▁▂▃▄▅▆▇⋆⎯·]/.test(s)) tags.add('lines');
     if (/[➤➳➶⇢⇨↠➵]/.test(s)) tags.add('arrows');
     if (/[🪐⚡🌙🌈🌊🍀🎯🪽🧊🌸🔥]/.test(s)) tags.add('emoji');
     if (/꧁|༒|✧‧˚|◥/.test(s)) tags.add('ornate').add('decorated');
     if (/♛|♜|♞|✪|✙/.test(s)) tags.add('crown').add('royal');
     if (/Small Caps/i.test(baseName)) tags.add('small');
     if (/Monospace/i.test(baseName)) tags.add('monospace');
     if (/Medieval/i.test(baseName)) tags.add('medieval');
     if (/Double-Struck/i.test(baseName)) tags.add('double-struck');
     if (/Circled/i.test(baseName)) tags.add('circled');
     if (/Full Width|Wide/i.test(baseName)) tags.add('wide');
     if (/Italic/.test(baseName)) tags.add('cursive');
     if (/Bold/.test(baseName)) tags.add('bold');
     if (/[яЯцЦдД]/i.test(s)) tags.add('russian');
     if (/[卂丂丨]/.test(s)) tags.add('asian');
     if (/[ѕԁκτρ]/i.test(s)) tags.add('mixed-script');
   
     if (/^[A-Za-z0-9 ]+$/.test(s) === false) tags.add('decorated');
     if (tags.has('emoji') || tags.has('kaomoji')) tags.add('cute');
     if (tags.has('weapons') || tags.has('arrows')) tags.add('attitude');
   
     return tags;
   }
   
   const CANDIDATE_STYLES = [];
   for (const base of BASE_STYLES) {
     for (let i = 0; i < WRAPPERS.length; i++) {
       const wrap = WRAPPERS[i];
       const fn = (s) => wrap(base.fn(s));
       CANDIDATE_STYLES.push({ name: `${base.name} #${i+1}`, baseName: base.name, fn });
     }
   }
   
   const seen = new Set();
   const UNIQUE_STYLES = [];
   for (const st of CANDIDATE_STYLES) {
     const k1 = st.fn(PREVIEW_A);
     const k2 = st.fn(PREVIEW_B);
     const key = k1 + '⟂' + k2;
     if (!seen.has(key)) {
       seen.add(key);
       st.previewA = k1;
       st.previewB = k2;
       st.tags = Array.from(classifyCategories(k1 + ' ' + k2, st.baseName));
       UNIQUE_STYLES.push(st);
     }
   }
   
   (function shuffle(arr){
     for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
   })(UNIQUE_STYLES);
   
   const STYLES = UNIQUE_STYLES.slice(0, 1400);
   
   /* ----------------------
      3.5) CATEGORY BAR
      ---------------------- */
   const CATEGORY_LIST = [
     {key:'fav',        label:'Fav'},
     {key:'all',        label:'All'},
     {key:'decorated',  label:'Decorated'},
     {key:'lines',      label:'Lines'},
     {key:'boxed',      label:'Boxed'},
     {key:'arrows',     label:'Arrows'},
     {key:'emoji',      label:'Emoji'},
     {key:'kaomoji',    label:'Kaomoji'},
     {key:'lenny',      label:'Lenny'},
     {key:'stars',      label:'Stars'},
     {key:'love',       label:'Love'},
     {key:'sexy',       label:'Sexy Art'},
     {key:'crown',      label:'Crowned'},
     {key:'weapons',    label:'Gun/Sword'},
     {key:'attitude',   label:'Attitude'},
     {key:'small',      label:'Small'},
     {key:'monospace',  label:'Monospace'},
     {key:'medieval',   label:'Medieval'},
     {key:'double-struck', label:'Double'},
     {key:'circled',    label:'Circled'},
     {key:'wide',       label:'Wide'},
     {key:'cursive',    label:'Cursive'},
     {key:'mixed-script', label:'Mixed Script'},
     {key:'asian',      label:'Asian'},
     {key:'russian',    label:'Russian'},
     {key:'royal',      label:'Royal'}
   ];
   
   function styleChipText(text, i){
     const pick = [maps.bold, maps.italic, maps.medieval, maps.doublestruck, maps.fullwidth, maps.circled, maps.smallcaps, maps.wide][i % 8];
     return stylize(text, pick);
   }
   
   function renderChips(activeKey='all'){
     catBar.innerHTML = '';
     CATEGORY_LIST.forEach((c, idx)=>{
       const btn = document.createElement('button');
       btn.className = 'chip' + (c.key===activeKey ? ' active' : '');
       btn.setAttribute('role','tab');
       btn.setAttribute('aria-selected', c.key===activeKey ? 'true':'false');
       btn.dataset.cat = c.key;
       if (c.key === 'fav') {
         btn.textContent = '❤️ Fav';
       } else {
         btn.innerText = styleChipText(c.label, idx);
       }
       catBar.appendChild(btn);
     });
   }
   
   /* ----------------------
      4) RENDERING (+ Like)
      ---------------------- */
   const BATCH = 28;
   let loaded = 0;
   let ACTIVE_LIST = STYLES.slice();
   let ACTIVE_CAT = 'all';
   
   function safeId(name){ return `out_${name.replace(/[^a-z0-9]+/gi,'_')}`; }
   
   function createCard(s){
     const id = safeId(s.name);
     const liked = likedIds.has(id) ? ' liked' : '';
     const card = document.createElement('div');
     card.className = 'card';
     card.setAttribute('data-tags', (s.tags||[]).join(','));
     const initialText = inputEl.value ? s.fn(inputEl.value) : s.fn(PLACEHOLDER);
     card.innerHTML = `
       <button class="likeBtn${liked}" data-like="${id}" aria-label="Like" aria-pressed="${liked ? 'true' : 'false'}" title="${liked ? 'Unlike' : 'Like'}">
         <svg viewBox="0 0 24 24" aria-hidden="true">
           <path d="M12.1 8.64l-.1.1-.1-.1C10.14 6.82 7.1 6.73 5.2 8.6c-1.99 1.97-1.99 5.17 0 7.14l5.96 5.89c.49.49 1.28.49 1.77 0L18.9 15.7c1.99-1.97 1.99-5.17 0-7.14-1.9-1.87-4.94-1.78-6.8.08z"/>
         </svg>
       </button>
       <button class="copyBtn topRight" data-copy="${id}" aria-label="Copy">
         <svg class="clip" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>
         <svg class="check" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2l-3.5-3.5L4 14.2 9 19l12-12-1.5-1.5z"/></svg>
       </button>
       <div class="outText" id="${id}">${initialText}</div>`;
     return card;
   }
   
   function loadNext(){
     const end = Math.min(loaded + BATCH, ACTIVE_LIST.length);
     const frag = document.createDocumentFragment();
     for(let i=loaded;i<end;i++) frag.appendChild(createCard(ACTIVE_LIST[i]));
     stylesEl.appendChild(frag);
     loaded = end;
   }
   
   function renderVisible(input){
     document.querySelectorAll('.outText').forEach(el=>{
       const s = ACTIVE_LIST.find(st => safeId(st.name) === el.id);
       if (!s) { el.textContent = input || PLACEHOLDER; return; }
       el.textContent = input ? s.fn(input) : s.fn(PLACEHOLDER);
     });
   }
   
   stylesEl.addEventListener('click', async (e)=>{
     const copyBtn = e.target.closest('[data-copy]');
     if (copyBtn) {
       const id = copyBtn.getAttribute('data-copy');
       const text = byId(id)?.innerText || '';
       try { await navigator.clipboard.writeText(text); } catch {}
       copyBtn.classList.add('copied');
       copyBtn.setAttribute('aria-label','Copied');
       setTimeout(()=>{ copyBtn.classList.remove('copied'); copyBtn.setAttribute('aria-label','Copy'); }, 1100);
       return;
     }
     const likeBtn = e.target.closest('[data-like]');
     if (!likeBtn) return;
     const lid = likeBtn.getAttribute('data-like');
     const isLiked = likeBtn.classList.toggle('liked');
     likeBtn.setAttribute('aria-pressed', isLiked ? 'true' : 'false');
     likeBtn.title = isLiked ? 'Unlike' : 'Like';
     if (isLiked) { likedIds.add(lid); } else { likedIds.delete(lid); }
     saveLikedIds(likedIds);
     if (ACTIVE_CAT === 'fav') {
       applyCategory('fav');
     }
     likeBtn.classList.remove('anim-reset'); void likeBtn.offsetWidth; likeBtn.classList.add('anim-reset');
   });
   
   let t;
   inputEl.addEventListener('input', e=>{
     clearTimeout(t);
     const v = e.target.value;
     t = setTimeout(()=>renderVisible(v), 60);
   });
   
   function resetAndLoad(){
     stylesEl.innerHTML = '';
     loaded = 0;
     loadNext();
   }
   resetAndLoad();
   
   const sentinel = byId('sentinel');
   if ('IntersectionObserver' in window && sentinel) {
     const io = new IntersectionObserver((entries)=>{
       entries.forEach(en=>{
         if(en.isIntersecting){
           loadNext();
           if(loaded >= ACTIVE_LIST.length) io.disconnect();
         }
       });
     },{root:null, rootMargin:'600px 0px', threshold:0});
     io.observe(sentinel);
   } else {
     while(loaded < ACTIVE_LIST.length) loadNext();
   }
   
   renderVisible('');
   
   /* ----------------------
      4.5) Chip interactions (filter)
      ---------------------- */
   function applyCategory(catKey){
     ACTIVE_CAT = catKey;
   
     const prevActive = catBar.querySelector('.chip.active');
     if (prevActive) { prevActive.classList.remove('active'); prevActive.setAttribute('aria-selected','false'); }
     const curr = catBar.querySelector(`[data-cat="${catKey}"]`);
     if (curr) { curr.classList.add('active'); curr.setAttribute('aria-selected','true'); }
   
     if (catKey === 'all') {
       ACTIVE_LIST = STYLES.slice();
     } else if (catKey === 'fav') {
       ACTIVE_LIST = STYLES.filter(st => likedIds.has(safeId(st.name)));
     } else {
       ACTIVE_LIST = STYLES.filter(st => (st.tags||[]).includes(catKey));
     }
     resetAndLoad();
     renderVisible(inputEl.value);
     if ('IntersectionObserver' in window && sentinel) {
       const io2 = new IntersectionObserver((entries)=>{
         entries.forEach(en=>{
           if(en.isIntersecting){
             loadNext();
             if(loaded >= ACTIVE_LIST.length) io2.disconnect();
           }
         });
       },{root:null, rootMargin:'600px 0px', threshold:0});
       io2.observe(sentinel);
     }
   }
   
   renderChips('all');
   catBar.addEventListener('click', (e)=>{
     const chip = e.target.closest('.chip');
     if (!chip) return;
     chip.classList.add('pulse');
     setTimeout(()=>chip.classList.remove('pulse'), 380);
   
     const key = chip.dataset.cat;
     applyCategory(key);
   });
   
   /* ----------------------
      5) MIC (unchanged)
      ---------------------- */
   let audioCtx;
   function beep(freq=880, duration=0.12, gain=0.06){
     try{
       audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
       const o = audioCtx.createOscillator();
       const g = audioCtx.createGain();
       o.type = 'sine'; o.frequency.value = freq; g.gain.value = gain;
       o.connect(g); g.connect(audioCtx.destination);
       const now = audioCtx.currentTime;
       g.gain.setValueAtTime(0, now);
       g.gain.linearRampToValueAtTime(gain, now + 0.01);
       g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
       o.start(now); o.stop(now + duration + 0.02);
     }catch(e){}
   }
   function playStartSound(){ beep(900, 0.12, 0.05); }
   function playStopSound(){ beep(520, 0.12, 0.05); }
   
   let recognizing = false; let recognition;
   const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
   if (SpeechRecognition) {
     recognition = new SpeechRecognition();
     recognition.lang = navigator.language || 'en-US';
     recognition.continuous = true; recognition.interimResults = true;
     let finalTranscript = '';
   
     recognition.onstart = () => {
       recognizing = true;
       micBtn.classList.add('listening');
       dock.classList.add('listening');
       micBtn.setAttribute('aria-pressed','true');
       micBtn.title = 'Stop dictation';
     };
     recognition.onerror = () => stopListening();
     recognition.onend = () => stopListening();
   
     recognition.onresult = (event) => {
       let interim = '';
       for (let i = event.resultIndex; i < event.results.length; i++) {
         const res = event.results[i];
         if (res.isFinal) { finalTranscript += res[0].transcript; }
         else { interim += res[0].transcript; }
       }
       inputEl.value = (finalTranscript + interim).trimStart();
       renderVisible(inputEl.value);
       // Also refresh builder viewer if open:
       if (builderOpen) computePreview();
     };
   
     function stopListening(){
       recognizing = false;
       micBtn.classList.remove('listening');
       dock.classList.remove('listening');
       micBtn.setAttribute('aria-pressed','false');
       micBtn.title = 'Start dictation';
     }
   
     micBtn.addEventListener('click', () => {
       if (!recognizing) {
         playStartSound();
         finalTranscript = inputEl.value ? inputEl.value + ' ' : '';
         try { recognition.start(); } catch {}
       } else {
         playStopSound();
         stopListening();
         recognition.stop();
       }
     });
   } else {
     micBtn.addEventListener('click', () => {
       beep(750,0.12,0.05);
       micBtn.classList.toggle('listening');
       dock.classList.toggle('listening');
       alert('Speech recognition is not supported in this browser. Try Chrome or Edge.');
     });
   }
   
   /* ----------------------
      6) Scroll state (unchanged)
      ---------------------- */
   window.addEventListener('scroll', () => {
     const header = document.querySelector('header');
     const dockWrap = document.querySelector('.dockWrap');
     const bottomBlur = document.querySelector('.bottomBlur');
     const scrolled = window.scrollY > 30;
     header.classList.toggle('scrolled', scrolled);
     if (dockWrap) dockWrap.classList.toggle('scrolled', scrolled);
     if (bottomBlur) bottomBlur.classList.toggle('scrolled', scrolled);
     const chipBarEl = document.getElementById('catBar');
     if (chipBarEl) chipBarEl.classList.toggle('scrolled', scrolled);
   });
   
   /* ===========================
      Custom Style Builder (ADD-ON)
      =========================== */
   
   /* 3.1) Insert the "Custom Style" button just before the mic */
   (function addCustomBtn(){
     const btn = document.createElement('button');
     btn.id = 'customStyleBtn';
     btn.className = 'iconBtn';
     btn.title = 'Build custom style';
     btn.setAttribute('aria-haspopup','dialog');
     btn.innerHTML = `
       <svg viewBox="0 0 24 24" aria-hidden="true">
         <!-- a magic-wand icon -->
         <path d="M5 21l-2-2 9-9 2 2-9 9zm7.1-11.9l2-2 2.8 2.8-2 2-2.8-2.8zM14.5 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/>
       </svg>`;
     micBtn.parentNode.insertBefore(btn, micBtn);
     btn.addEventListener('click', openBuilder);
   })();
   
   /* 3.2) Dialog refs */
   const overlay = document.getElementById('styleBuilderOverlay');
   const panel   = document.getElementById('styleBuilderPanel');
   const viewerOut = document.getElementById('viewerOut');
   const baseStyleSelect = document.getElementById('baseStyleSelect');
   const baseStyleStrip  = document.getElementById('baseStyleStrip'); // NEW
   const wrapperCats = document.getElementById('wrapperCats');
   const wrapperVariants = document.getElementById('wrapperVariants');
   const saveCustomBtn = document.getElementById('saveCustomBtn');
   const closeStyleBuilder = document.getElementById('closeStyleBuilder');
   
   /* 3.3) Keep dock visible: set overlay bottom to dock height */
   function syncOverlayBottom(){
     const rect = dock.getBoundingClientRect();
     overlay.style.bottom = `${Math.ceil(rect.height + 24)}px`;
   }
   window.addEventListener('resize', syncOverlayBottom);
   syncOverlayBottom();
   
   /* 3.4) Build base style select */
   const BASE_OPTIONS = BASE_STYLES.map((s, i) => ({label: s.name, idx: i}));
   function renderBaseSelect(selectedIdx = 0){
     baseStyleSelect.innerHTML = '';
     BASE_OPTIONS.forEach(opt=>{
       const o = document.createElement('option');
       o.value = String(opt.idx);
       o.textContent = opt.label;
       baseStyleSelect.appendChild(o);
     });
     baseStyleSelect.value = String(selectedIdx);
   }
   
   /* --- NEW: Build the horizontal live preview strip for base styles --- */
   function renderBaseStrip(selectedIdx = +baseStyleSelect.value || 0){
     if (!baseStyleStrip) return;
     const sample = (inputEl.value || PLACEHOLDER);
     baseStyleStrip.innerHTML = '';
     BASE_STYLES.forEach((bs, i)=>{
       const btn = document.createElement('button');
       btn.className = 'baseCard' + (i===selectedIdx ? ' active' : '');
       btn.type = 'button';
       btn.setAttribute('aria-pressed', i===selectedIdx ? 'true' : 'false');
       btn.setAttribute('data-idx', String(i));
       btn.title = bs.name;
       btn.textContent = bs.fn(sample);
       baseStyleStrip.appendChild(btn);
     });
   }
   
   /* Keep strip previews in sync while typing */
   inputEl.addEventListener('input', ()=>{
     if (!builderOpen) return;
     renderBaseStrip(+baseStyleSelect.value || 0);
   });
   
   /* 3.5) Wrapper categories & variants */
   const WRAP_SOURCES = [
     {key:'NONE', label:'None', list:[['','']]},
     {key:'KAOMOJI', label:'Kaomoji', list: frames.KAOMOJI},
     {key:'LENNY', label:'Lenny', list: frames.LENNY},
     {key:'EMOJI', label:'Emoji', list: frames.EMOJI},
     {key:'BOX', label:'Boxes', list: frames.BOX},
     {key:'LINES', label:'Lines', list: frames.LINES},
     {key:'ORNATE', label:'Ornate', list: frames.ORNATE},
     {key:'ARROWS', label:'Arrows', list: frames.ARROWS},
     {key:'THEME', label:'Themes', list: frames.THEME}
   ];
   
   let activeWrapKey = 'NONE';
   let activeWrapVariantIdx = 0;
   function renderWrapperCats(){
     wrapperCats.innerHTML = '';
     WRAP_SOURCES.forEach(src=>{
       const pill = document.createElement('button');
       pill.className = 'pill' + (src.key===activeWrapKey ? ' active' : '');
       pill.textContent = src.label;
       pill.dataset.key = src.key;
       wrapperCats.appendChild(pill);
     });
   }
   function renderWrapperVariants(){
     const src = WRAP_SOURCES.find(s => s.key === activeWrapKey);
     wrapperVariants.innerHTML = '';
     src.list.forEach((pair, idx)=>{
       const [L, R] = pair;
       const pill = document.createElement('button');
       pill.className = 'pill' + (idx===activeWrapVariantIdx ? ' active' : '');
       pill.textContent = (L || '⟨none⟩') + 'Aa' + (R || '');
       pill.dataset.idx = String(idx);
       wrapperVariants.appendChild(pill);
     });
   }
   
   /* 3.6) Compose preview */
   function makeWrapperFn(wrapKey, wrapIdx){
     const src = WRAP_SOURCES.find(s => s.key === wrapKey);
     const [L, R] = (src && src.list[wrapIdx]) ? src.list[wrapIdx] : ['',''];
     return (t)=> `${L}${t}${R}`;
   }
   function computePreview(){
     const baseIdx = +baseStyleSelect.value || 0;
     const base = BASE_STYLES[baseIdx] || BASE_STYLES[0];
     const wrapFn = makeWrapperFn(activeWrapKey, activeWrapVariantIdx);
     const sourceText = inputEl.value || PLACEHOLDER;
     const result = wrapFn(base.fn(sourceText));
     viewerOut.textContent = result;
     // keep strip active state synced
     renderBaseStrip(baseIdx);
     return { baseIdx, wrapKey: activeWrapKey, wrapIdx: activeWrapVariantIdx, result };
   }
   
   /* 3.7) Behavior: open/close with bounce */
   let builderOpen = false;
   function openBuilder(){
     if (builderOpen) return;
     builderOpen = true;
     syncOverlayBottom();
     overlay.classList.add('open');
     panel.classList.remove('hide');
     panel.classList.add('show');
     overlay.setAttribute('aria-hidden','false');
     document.body.style.overflow = 'hidden';
     computePreview();
   }
   function closeBuilder(){
     if (!builderOpen) return;
     panel.classList.remove('show');
     panel.classList.add('hide');
     setTimeout(()=>{
       overlay.classList.remove('open');
       overlay.setAttribute('aria-hidden','true');
       document.body.style.overflow = '';
       builderOpen = false;
     }, 460);
   }
   closeStyleBuilder.addEventListener('click', closeBuilder);
   overlay.addEventListener('click', (e)=>{ if (e.target === overlay) closeBuilder(); });
   document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeBuilder(); });
   
   /* 3.8) Wire picker interactions */
   baseStyleSelect.addEventListener('change', computePreview);
   
   /* NEW: base strip click + keyboard support */
   baseStyleStrip.addEventListener('click', (e)=>{
     const card = e.target.closest('.baseCard');
     if (!card) return;
     const idx = +card.dataset.idx;
     baseStyleSelect.value = String(idx);
     computePreview();
   });
   baseStyleStrip.addEventListener('keydown', (e)=>{
     if (!['ArrowLeft','ArrowRight'].includes(e.key)) return;
     e.preventDefault();
     const max = BASE_STYLES.length - 1;
     let idx = +baseStyleSelect.value || 0;
     idx = e.key === 'ArrowRight' ? Math.min(max, idx + 1) : Math.max(0, idx - 1);
     baseStyleSelect.value = String(idx);
     computePreview();
   });
   
   wrapperCats.addEventListener('click', (e)=>{
     const pill = e.target.closest('.pill'); if(!pill) return;
     activeWrapKey = pill.dataset.key;
     renderWrapperCats();
     activeWrapVariantIdx = 0;
     renderWrapperVariants();
     computePreview();
   });
   wrapperVariants.addEventListener('click', (e)=>{
     const pill = e.target.closest('.pill'); if(!pill) return;
     activeWrapVariantIdx = +pill.dataset.idx;
     renderWrapperVariants();
     computePreview();
   });
   
   /* initial renders */
   renderBaseSelect(0);
   renderWrapperCats();
   renderWrapperVariants();
   renderBaseStrip(0);
   
   /* 3.9) Saving custom designs */
   const CUSTOM_KEY = 'customStylesV1';
   function loadCustoms(){ try { return JSON.parse(localStorage.getItem(CUSTOM_KEY)) || []; } catch { return []; } }
   function saveCustoms(arr){ localStorage.setItem(CUSTOM_KEY, JSON.stringify(arr)); }
   
   /* On boot: hydrate any previously saved customs into STYLES list */
   (function hydrateCustoms(){
     const customs = loadCustoms();
     customs.forEach(rec=>{
       const base = BASE_STYLES[rec.baseIdx] || BASE_STYLES[0];
       const wrapFn = makeWrapperFn(rec.wrapKey, rec.wrapIdx);
       const fn = (s)=> wrapFn(base.fn(s));
       const name = rec.name;
       const st = {
         name, baseName: base.name, fn,
         previewA: fn(PREVIEW_A), previewB: fn(PREVIEW_B),
         tags: Array.from(new Set(['decorated','custom']))
       };
       STYLES.unshift(st);
     });
   })();
   
   // helpers
function currentCustomNameId(){
  const { baseIdx, wrapKey, wrapIdx } = computePreview();
  const base = BASE_STYLES[baseIdx] || BASE_STYLES[0];
  const name = `Custom ${base.name} + ${wrapKey} #${wrapIdx+1}`;
  const id = safeId(name);
  return { name, id, baseIdx, wrapKey, wrapIdx, base };
}

function ensureCustomExists({ name, baseIdx, wrapKey, wrapIdx, base }){
  const wrapFn = makeWrapperFn(wrapKey, wrapIdx);
  const fn = (s)=> wrapFn(base.fn(s));
  if (!STYLES.find(s => s.name === name)) {
    STYLES.unshift({
      name, baseName: base.name, fn,
      previewA: fn(PREVIEW_A), previewB: fn(PREVIEW_B),
      tags: Array.from(new Set(['decorated','custom']))
    });
  }
}

// toggle like/unlike for dialog heart
function toggleSaveCustom(){
  const rec = currentCustomNameId();
  ensureCustomExists(rec);

  const customs = loadCustoms();
  const isAlreadySaved = customs.some(c => c.name === rec.name);

  // flip visual state
  const isLikedNow = saveCustomBtn.classList.toggle('liked');
  saveCustomBtn.setAttribute('aria-pressed', isLikedNow ? 'true' : 'false');
  saveCustomBtn.title = isLikedNow ? 'Unsave from Favorites' : 'Save to Favorites';

  if (isLikedNow) {
    // persist like
    likedIds.add(rec.id); saveLikedIds(likedIds);
    if (!isAlreadySaved) {
      customs.unshift({ name: rec.name, baseIdx: rec.baseIdx, wrapKey: rec.wrapKey, wrapIdx: rec.wrapIdx });
      saveCustoms(customs);
    }
    // burst animation every like
    saveCustomBtn.classList.remove('burst'); void saveCustomBtn.offsetWidth; saveCustomBtn.classList.add('burst');
    setTimeout(()=> saveCustomBtn.classList.remove('burst'), 420);
  } else {
    // remove like
    likedIds.delete(rec.id); saveLikedIds(likedIds);
    // optionally remove its recipe from storage
    saveCustoms(customs.filter(c => c.name !== rec.name));
  }

  // keep list views in sync
  if (ACTIVE_CAT === 'fav') applyCategory('fav');
  renderVisible(inputEl.value);
}

// wire it
saveCustomBtn.addEventListener('click', toggleSaveCustom);

// when reopening the builder, reflect persisted state
function resetSaveBtn(){
  const { id } = currentCustomNameId();
  const isLiked = likedIds.has(id);
  saveCustomBtn.classList.toggle('liked', isLiked);
  saveCustomBtn.setAttribute('aria-pressed', isLiked ? 'true' : 'false');
}
document.getElementById('customStyleBtn').addEventListener('click', resetSaveBtn);
document.getElementById('customStyleBtn')?.classList.add('pulsing');


   
   /* When reopening, reset heart visual state */
   function resetSaveBtn(){
     saveCustomBtn.classList.remove('liked');
     saveCustomBtn.setAttribute('aria-pressed','false');
   }
   document.getElementById('customStyleBtn').addEventListener('click', resetSaveBtn);
   

   