// Tamil Grammar checking utility ported from Tamil_GrammarChecker_js.js
// Exposes logic to check Tamil sandhi (ஒற்றுப் பிழை) and other common grammatical patterns.

export interface WordAnalysis {
  index: number;
  original: string;
  cleaned: string;
  status: 'correct' | 'grammar-add' | 'grammar-del' | 'grammar-error' | 'spelling-error';
  suggestion?: string;
  reasons: string[];
}

const splitClean = (str: string) => str.split(",").map(x => x.trim()).filter(Boolean);

// ============================================================================
// பொதுவான தரவுகள் மற்றும் அடிப்படைச் சார்புகள் (General Data & Basic Utilities)
// ============================================================================

const nspecial = splitClean("1,2,3,4,5,6,7,8,9,0,”,“,[,],=,+,;,?,(,),-,!,.,’,‘,:,%,*");
const nonvow = splitClean("ா,ி,ீ,ு,ூ,ெ,ே,ை,ொ,ோ,ௌ,்");
const uyir = splitClean("அ,ஆ,இ,ஈ,உ,ஊ,எ,ஏ,ஐ,ஒ,ஓ,ஔ");
const mey = splitClean("க,ங,ச,ஞ,ட,த,ந,ப,ம,ய,ர,ல,வ,ற,ள,ழ,ண,ன");

const d0 = "இடைச்சொல்";
const d1 = "குறிப்புப் பெயரெச்சம்";
const d2 = "எண்ணுப்பெயர்";
const d3 = "எதிர்மறைப் பெயரெச்சம்";
const d4 = "உயர்திணைச் சொல்";
const d5 = "ஒற்றெழுத்து";
const d6 = "உணர்ச்சி வார்த்தை";
const d7 = "உயிரெழுத்து";
const d8 = "பலர்பாற் படர்க்கை விகுதி";
const d9 = "ஒன்றன்பால் விகுதி";
const da = "பலவின்பால் விகுதி";
const u2 = "இரண்டாம் வேற்றுமை உருபு";
const u3 = "மூன்றாம் வேற்றுமை உருபு";
const u4 = "நான்காம் வேற்றுமை உருபு";
const u5 = "ஐந்தாம் வேற்றுமை உருபு";
const u6 = "ஆறாம் வேற்றுமை உருபு";
const u7 = "ஏழாம் வேற்றுமை உருபு";
const p1 = "சுட்டெழுத்து";
const p2 = "முற்றியலுகரச்சொல்";
const p3 = "சுட்டுப்பெயர்";
const p4 = "மென்தொடர்க் குற்றியலுகர வினைச்சொல்";
const p5 = "ஈறுகெட்ட எதிர்மறைப் பெயரெச்சம்";
const p6 = "பெயரெச்சத்தோடு படி";
const p7 = "மகரம் கெட்ட சொல்";
const p8 = "வன்தொடர்க் குற்றியலுகர வினையெச்சச்சொல்";

// விதி விளக்கங்களை மாற்றும் துணைக் காரணி
function cleanRulePlaceholders(arr: string[]): string[] {
  return arr.map(val => {
    let s = val;
    s = s.replace(/d0/gi, d0);
    s = s.replace(/d1/gi, d1);
    s = s.replace(/d2/gi, d2);
    s = s.replace(/d3/gi, d3);
    s = s.replace(/d4/gi, d4);
    s = s.replace(/d5/gi, d5 + "-" + val.split("|")[0]);
    s = s.replace(/d6/gi, d6);
    s = s.replace(/d7/gi, d7 + "-" + val.split("|")[0]);
    s = s.replace(/d8/gi, d8);
    s = s.replace(/d9/gi, d9);
    s = s.replace(/da/gi, da);
    s = s.replace(/u2/gi, u2 + " உள்ள");
    s = s.replace(/u3/gi, u3 + "-" + val.split("|")[0]);
    s = s.replace(/u4/gi, u4 + " உள்ள");
    s = s.replace(/u6/gi, u6 + " உள்ள");
    s = s.replace(/u7/gi, u7 + "-" + val.split("|")[0]);
    s = s.replace(/p1/gi, p1);
    s = s.replace(/p2/gi, p2);
    s = s.replace(/p3/gi, p3);
    s = s.replace(/p4/gi, p4);
    s = s.replace(/p5/gi, p5);
    s = s.replace(/p6/gi, p6);
    s = s.replace(/p7/gi, p7);
    s = s.replace(/p8/gi, p8);
    return s;
  });
}

// வார்த்தையிலிருந்து குறியீடுகளை நீக்கி சுத்தமான தமிழ் எழுத்துக்களை மட்டும் பெறுதல்
function getCleanTamilWord(w: string): string {
  if (!w) return "";
  let clean = "";
  for (let i = 0; i < w.length; i++) {
    const code = w.charCodeAt(i);
    // தமிழ் எழுத்துக்கள் வரம்பு (0x0B80 முதல் 0x0D7F வரை)
    if (code >= 2944 && code <= 3455) {
      clean += w[i];
    }
  }
  return clean;
}


// ============================================================================
// பிரிவு 1: சந்திப் பிழை விதிகள் (Sandhi Error Rules)
// ============================================================================

// சந்தி விதித் தரவுகள் (Rules Datasets)
const ssol = splitClean("கடைசி|,சின்ன|,வேண்டா|p5,ஏற்று|,எல்லா|p7,அந்த|,எந்த|,இந்த|,அப்படி|,அங்கு|,எங்கு|,இங்கு|,ஆங்கு|,ஈங்கு|,யாங்கு|,இப்படி|,எப்படி|,ஈண்டு|,ஆண்டு|,யாண்டு|,எத்துணை|,அத்துணை|,இத்துணை|,தனி|,என|,முன்னர்|,பின்னர்,அரை|,பாதி|,இன்றி|,அன்றி|,மற்றை|,சிறப்பு|,அ|p1,இ|p1,எ|p1,நடு|p2,புது|p2,பொது|p2,பசு|p2,திரு|p2,முழு|p2,விழு|p2,பழ|p2,என்னை|u2,நம்மை|u2,எம்மை|u2,உன்னை|u2,நின்னை|u2,உம்மை|u2,உங்களை|u2,தன்னை|u2,தம்மை|u2,தங்களை|u2,அவளை|u2,அவனை|u2,இவரை|u2,அவரை|u2,அதனை|u2,இதனை|u2,எதனை|u2,அவற்றை|u2,இவற்றை|u2,எவற்றை|u2,என்பதை|u2,அதை|u2,இதை|u2,எதை|u2,தமிழை|u2,வில்லை|u2,பொருட்டு|u4,எனக்கு|u4,எனக்காக|u4,நமக்கு|u4,எமக்கு|u4,நமக்காக|u4,எமக்காக|u4,உனக்கு|u4,நினக்கு|u4,உனக்காக|u4,நினைக்காக|u4,உமக்கு|u4,உங்களுக்கு|u4,உமக்காக|u4,உங்களுக்காக|u4,தனக்கு|u4,தனக்காக|u4,தமக்கு|u4,தமக்காக|u4,தங்களுக்கு|u4,அவற்கு|u4,அவட்கு|u4,அவர்க்கு|u4,தங்களுக்காக|u4,அதற்கு|u4,இதற்கு|u4,எதற்கு|u4,அவற்றிற்கு|u4,இவற்றிற்கு|u4,எவற்றிற்கு|u4,நிறைய|,குறைய|,முคัญ|p7,அடுத்த|,சரிவர|,அதிக|p7,வாக்கிய|p7,ஐக்கிய|p7,இலக்கிய|p7,ஆரோக்கிய|p7,பாக்கிய|p7,அற்று|p8");
const cssol = splitClean("தெரு,அணு,வரி");
const sviku = splitClean("மிக|மிக,தவிர|தவிர,பற்றி|பற்றி,மாற|மாற,கூட|கூட,போல|போல,தவ|தவ,வகை|வகை,ிலக்கிய|இலக்கிய,லன்றி|அன்றி,தன்றி|அன்றி");
const nviku = splitClean("ே|d0-ஏ,ோ|d0-ஓ,க்|d5,ங்|d5,ச்|d5,ஞ்|d5,ட்|d5,ண்|d5,த்|d5,ந்|d5,ம்|d5,ப்|d5,ற்|d5,ல்|d5,வ்|d5,ள்|d5,ன்|d5,ஸ்|d5,ஷ்|d5,ஜ்|d5,ஹ்|d5,அ|d7,ஆ|d7,இ|d7,ஈ|d7,உ|d7,ஊ|d7,எ|d7,ஏ|d7,ஐ|d7,ஒ|d7,ஓ|d7,ஔ|d7,ஃ|d7,னர்|d8-அர்,தார்|d8-ஆர்,கின்றனர்|d8-அர்,கின்றார்|d8-ஆர்,றோர்|d8-ஓர்,கிறார்|d8-ஆர்,யார்|d8-ஆர்,வர்|d8-அர்,வார்|d8-ஆர்,வோர்|d8-ஓர்,கின்றது|d9-அது,தது|d9-அது,க்கிறது|d9-அது,பது|d9-அது,வது|d9-அது,ன்றன|da-அன,ிர்|d4,கொண்டு|u3,கீழே|u7,மேலே|u7,கீழ்|u7,ோட|u6-ஓட,ுடைய|u6-உடைய,ொரு|ஒரு,ிரு|இரு,போது|போது,டற்ற|d3-அற்ற,மற்ற|d3-அற்ற,வற்ற|d3-அற்ற,ில்லாத|d3-இல்லாத,மானவை|ஆனவை,ுமுறை|முறை,்முறை|முறை,ைமுறை|முறை,தமுறை|முறை,லமுறை|முறை,ென்ன|d6-என்ன,வந்து|வந்து,இல்லை|இல்லை,ில்லை|இல்லை,ிரண்டு|d2-இரண்டு,நூறு|d2-நூறு,டது|அது,யவை|அவை,றவை|அவை,ுன்னு|என்று,ென்று|p4-என்று,ேன்னு|என்று,போன்ற|போன்ற,தகாத|d3-தகாத,பிறகு|பிறகு,வேளை|வேளை,போன்று|போன்று,வெகு|வெகு,சிறிய|d1,பெரிய|d1,புதிய|d1,ன்படி|p6,ல்படி|p6,ம்படி|p6,துவரை|வரை,்வரை|வரை,வேறு|வேறு,மல்ல|அல்ல,தல்ல|அல்ல,றிரவு|இரவு");
const nsol = splitClean("நன்கு|p4,கடந்து|p4,நடந்து|p4,தொடர்ந்து|p4,வரை|,நேற்று|,வெகு|,இனி|d0,நல்ல|d1,கரிய|d1,அரிய|d1,பழைய|d1,இனிய|d1,இளைய|,மூத்த|,அங்க|,அங்கே|,இங்க|,இங்கே|,ஏதோ|,நீங்க|,இவரு|,நீ|,உங்களது|u6,இவரது|u6,அவரது|u6,எனது|u6,உனது|u6,நினது|u6,தமது|u6,தனது|u6,அது|p3,எது|p3,இது|p3,உது|p3,நமது|u6,எமது|u6,உமது|u6,ஏது|,ஏன்|,யாது|,அவை|,எவை|,இவை|,யாவை|,அத்தனை|,எத்தனை|,இத்தனை|,அவ்வளவு|,எவ்வளவு|,இவ்வளவு|,இத்தகைய|,அத்தகைய|,எத்தகைய|,எது|,என்பது|,பண்டு|d0,முந்து|d0,அன்று|d0,நாளை|d0,இன்று|d0,என்று|d0,அன்றைய|d0,நேற்றைய|d0,நாளைய|d0,இன்றைய|d0,என்றைய|d0,முந்தைய|d0,பிந்தைய|d0,அவ்வாறு|,இவ்வாறு|,எவ்வாறு|,ஒன்று|d2,இரண்டு|d2,மூன்று|d2,நான்கு|d2,ஐந்து|d2,ஆறு|d2,ஏழு|d2,ஒன்பது|d2,நூறு|d2,ஒரு|d2,ஓர்|d2,இரு|d2,அறு|d2,எழு|d2,பல|d2,சில|d2,என்ன|,சிறு|,முது|,மறு|,என்ற|,புகழ்|,கண்டு|,செய்து|,சரியான|,என்றோ|,அன்ன|,ஒரே|d2,இல்லாத|d3,செல்லாத|d3,காணாத|d3,ஓடாத|d3,அம்மா|d4,அப்பா|d4,தம்பி|d4,தங்கை|d4,அக்கா|d4,அண்ணா|d4,தாத்தா|d4,பாட்டி|d4,தோழி|d4,நண்பர்|d4,மனைவி|d4,தந்தை|d4,மாமா|d4,என்னோடு|,தன்னொடு|,அல்லது|,அல்லாது|,அல்ல|,இதோ|,அதோ|,மேதகு|,மாண்புமிகு|,டாக்டர்|,பலர்|,சிலர்|,சும்மா|,முதலிய|,சரி|,பிற|,அக்கறை|,நன்றி|,முடியாது|,ஆகிய|,இரவு|,தவறு|,உங்க|,சிறந்த|d1");
const nvarusol = splitClean("சரியா,சரியா?,பாணம்,குரு,சார்");
const cnvarusol = splitClean("கூட");
const nvaru = splitClean("தெய்வ,தேசிய,பாணி,சுவாமி,சக்தி,தினம்");
const vecham = splitClean("போக|1,பட|1,மடைய|1,யடைய|1,வடைய|1,ிருக்க|1,ய்ய|1,கொள்ள|1,வாங்கி|1,டங்கி|1,மாய்|1,அழைத்து|1,சித்து|1,ிக்க|1,ுத்த|2,ைக்க|1,ுக்க|1,ியங்க|1,வதாய்|1,என|1,ஆக|1,ராகி|1,ாய்|2,ென|1,படுத்தி|1,ோற்றி|1,ாற்றி|1,ப்பி|1,ர்த்தி|1,ின்றி|1,ும்ப|1,ப்பட்டு|1,ப்பட|1,போய்|1,விட|2,க|1,ச|1,ட|1,த|1,ப|1,ற|1,ய|1,ர|1,ல|1,வ|1,ழ|1,ள|1,றி|2,ி|0,ோய்|0,ன்ற|0");
const pecham = splitClean("னாய்|,னைய|,த்தக்க|,தக்க|,பெற்ற|,ுவான|,ள்ள|,சென்ற|,டந்த|,வந்த|,கொண்ட|,ாகிய|,்பான|,தற்கான|,க்கான|,ற்கான|,ழகான|,டான|,க்கிய|2,ங்கிய|,ஞ்சிய|,ட்டிய|,த்திய|,ம்பிய|,வ்விய|,லாவிய|,ள்ளிய|,ல்லிய|,ண்ணிய|,த்திய|,ற்றிய|,ுதிய|,ுவிய|,யான|,கமான|,சமான|,டமான|,தமான|,பமான|,றமான|,யமான|,ரமான|,லமான|,்வமான|,ழமான|,ளமான|,னமான|,களான|,கூடிய|,வறான|,லான|,ரான|,க்குரிய|,றந்த|,ுத்த|,றித்த|,ைத்த|,ைந்த|,ித்த|,ேர்ந்த|,ார்ந்த|,லகிய|,ளகிய|,ழகிய|,்டிய|,ிருந்த|,ுந்த|,ேசிய|,ிய|0,த்த|0,கிற|,ந்த|0,கின்ற|,போன|,ப்பட்ட|,ற்பட்ட|,ைபட்ட|,விட்ட|,மிட்ட|,லிட்ட|,ான|0");
const epecham = splitClean("ையாத|,ியாத|,க்காத|,ங்காத|,ிகாத|,ச்சாத|,ஞ்சாத|,ட்டாத|,த்தாத|,ந்தாத|,ம்பாத|,ய்யாத|,ல்லாத|,வாத்|,ன்றாத|,ள்ளாத|,ணாத|,ன்னாத|,றாத|,ாராத|,வராத|,ாத|0");
const mviku = splitClean("ம்ப,றாட,லக,ணிக,ழக,தேக,முக,மத,டக்க,கில,மூக,ரக,ரவ,கண,ாய,ஞான,்தர,ாதார,சார,கர,தய,தள,பாண,ரண,வண,மண,பண,யண,தக,னத,ரத,கால,துவ,ிமான,ணைய,விட,நுண்ணிய,பெண்ணிய,புண்ணிய");

const processedNsol = cleanRulePlaceholders(nsol);
const processedNviku = cleanRulePlaceholders(nviku);
const processedSsol = cleanRulePlaceholders(ssol);

// சந்தி விதி சரிபார்ப்புத் துணைக் காரணி (Sandhi Helper)
function checkSandhiRules(wordIdx: number, words: string[], wordData: string[][]) {
  const i = wordIdx + 1;
  if (wordData[i - 1][4] === "2") return;
  
  if (wordData[i][4] === "1" || wordData[i][4] === "4" || wordData[i][4] === "0") {
    wordData[i - 1][1] += `<li>4 ஆம் வேற்றுமைத் தொகை (${words[i - 1]}+ ஆக/க்கு ${words[i]})</li>`;
    wordData[i - 1][1] += `<li>6 ஆம் வேற்றுமைத் தொகை (${words[i - 1]}+ உடைய/பற்றிய/அது ${words[i]})</li>`;
    wordData[i - 1][1] += `<li>உவமைத்தொகை (${words[i - 1]} போன்ற ${words[i]})</li>`;
    wordData[i - 1][1] += `<li>பண்புத் தொகை, ஊர்ப்பெயர் என்றால் வலிமிகும்.</li>`;
  }
  if (wordData[i][4] === "2" || wordData[i][4] === "0") {
    wordData[i - 1][2] += `<li>7 ஆம் வேற்றுமைத் தொகை(${words[i - 1]}+ இல்/கண் ${words[i]})</li>`;
    wordData[i - 1][2] += `<li>5 ஆம் வேற்றுமைத் தொகை (${words[i - 1]}+ இன்/இருந்து ${words[i]})</li>`;
    wordData[i - 1][2] += `<li>3 ஆம் வேற்றுமைத் தொகை (${words[i - 1]}+ ஆல்/ஓடு ${words[i]})</li>`;
    wordData[i - 1][2] += `<li>2 ஆம் வேற்றுமைத் தொகை (${words[i - 1]}+ ஐ ${words[i]})</li>`;
  }
  wordData[i - 1][2] += `<li>உம்மைத்தொகை (${words[i - 1]}+ உம், ${words[i]}+உம்)</li>`;
  wordData[i - 1][2] += `<li>எழுவாய்த் தொடர் (${words[i - 1]}- எழுவாய், ${words[i]}- பயனிலை)</li>`;
  wordData[i - 1][2] += `<li>விளித் தொடர் (${words[i]}-அவள் வினையென்றால்)</li>`;
  wordData[i - 1][2] += `<li>வினைத்தொகை, அடுக்குத் தொடர், இரட்டைக்கிளவி என்றால் வலிமிகாதது</li>`;
}

// 1. அடிப்படை வலிமிகும் / வலிமிகா சந்தி விதிகளைப் பயன்படுத்துதல் (Apply Basic Sandhi Rules)
function applySandhiRules(words: string[], wordData: string[][], isBoundary: boolean[], rawWords: string[]) {
  for (let i = 1; i < words.length - 1; i++) {
    if (isBoundary[i - 1]) {
      wordData[i - 1][0] = " ";
      wordData[i - 1][2] += "<li>முற்றுப்புள்ளி/வாக்கிய/வரி முடிவுக்குப் பின் வலிமிகாது</li>";
      continue;
    }

    const prev = words[i - 1];
    const curr = words[i];

    const lastCharCode = prev.charCodeAt(prev.length - 1);
    const nextFirstChar = curr[0];

    // Basic filters where sandhi does not apply
    if (lastCharCode < 126 && lastCharCode > 46) {
      wordData[i - 1][0] = " ";
      wordData[i - 1][2] += `<li>இலத்தீன்/எண் குறியீட்டிற்குப் பின் வழி மிகாது</li>`;
    }
    
    // Check if next word starts with k, c, t, p
    const startsWithKCTP = nextFirstChar === String.fromCharCode(2965) || 
                           nextFirstChar === String.fromCharCode(2970) || 
                           nextFirstChar === String.fromCharCode(2980) || 
                           nextFirstChar === String.fromCharCode(2986);
    if (!startsWithKCTP) {
      wordData[i - 1][0] = " ";
      wordData[i - 1][2] += `<li>அடுத்த வார்த்தை 'க', 'ச', 'த', 'ப' எழுத்துகளில் தொடங்கவில்லை</li>`;
    }

    if (curr[1] === "்") {
      wordData[i - 1][0] = " ";
      wordData[i - 1][2] += `<li>அடுத்த வார்த்தை ஒற்றெழுத்தில் தொடங்குவதால் வலிமிகாது</li>`;
    }

    // Match nsol (வலிமிகா இடைச்சொற்கள்)
    if (wordData[i - 1][0] === "0") {
      for (const val of processedNsol) {
        const parts = val.split("|");
        if (prev === parts[0]) {
          wordData[i - 1][0] = " ";
          wordData[i - 1][2] += `<li>${parts[1] || 'இடைச்சொல்'} - '${parts[0]}' என்ற வார்த்தைக்குப் பின் மிகாது</li>`;
          break;
        }
      }
    }

    // Match ssol (வலிமிகும் இடைச்சொற்கள்)
    if (wordData[i - 1][0] === "0") {
      for (const val of processedSsol) {
        const parts = val.split("|");
        if (prev === parts[0]) {
          wordData[i - 1][0] = "1";
          wordData[i - 1][1] += `<li>${parts[1] || 'இடைச்சொல்'} - '${parts[0]}' என்ற வார்த்தைக்குப் பின் மிகும்</li>`;
          wordData[i - 1][4] = "4";
          break;
        }
      }
    }

    // Match nviku (வலிமிகா விகுதிகள்)
    if (wordData[i - 1][0] === "0") {
      for (const val of processedNviku) {
        const parts = val.split("|");
        if (prev.endsWith(parts[0])) {
          wordData[i - 1][0] = " ";
          wordData[i - 1][2] += `<li>${parts[1] || 'விகுதி'} என்று முடியும் சொல்லுக்கு மிகாது</li>`;
          break;
        }
      }
    }

    // Match sviku (வலிமிகும் விகுதிகள்)
    if (wordData[i - 1][0] === "0") {
      for (const val of sviku) {
        const parts = val.split("|");
        if (prev.endsWith(parts[0])) {
          wordData[i - 1][0] = "1";
          wordData[i - 1][1] += `<li>${parts[1] || 'சொல்'} என்று முடியும் சொல்லுக்கு முன் மிகும்</li>`;
          break;
        }
      }
    }

    // Match nvaru / nvarusol
    if (wordData[i - 1][0] === "0") {
      for (const val of nvaru) {
        if (curr.startsWith(val)) {
          wordData[i - 1][0] = " ";
          wordData[i - 1][2] += `<li>'${val}' என்ற வார்த்தை அடுத்ததாக வருவதால் வலிமிகாது</li>`;
          break;
        }
      }
    }

    if (wordData[i - 1][0] === "0") {
      for (const val of nvarusol) {
        if (curr === val) {
          wordData[i - 1][0] = " ";
          wordData[i - 1][2] += `<li>'${val}' என்ற வார்த்தை அடுத்ததாக வருவதால் வலிமிகாது</li>`;
          break;
        }
      }
    }
  }

  // 2. வினையெச்சம், பெயரெச்சம் மற்றும் மகர ஈற்றுப் புணர்ச்சி விதிகள்
  for (let i = 1; i < words.length - 1; i++) {
    if (isBoundary[i - 1]) continue;

    const prev = words[i - 1];
    const curr = words[i];

    if (wordData[i - 1][0] === "0") {
      for (const val of vecham) {
        const parts = val.split("|");
        if (prev.endsWith(parts[0])) {
          if (parts[1] === "1") {
            wordData[i - 1][0] = "1";
            wordData[i - 1][1] += `<li>வினையெச்சமாக இருந்தால் வலி மிகும்</li>`;
            checkSandhiRules(i - 1, words, wordData);
            wordData[i - 1][4] = "2";
          } else if (parts[1] === "0") {
            wordData[i - 1][0] = " ";
            wordData[i - 1][1] += `<li>வினையெச்சமாக இருந்தால் வலி மிகாது</li>`;
          } else if (parts[1] === "2" && wordData[i][4] === "2") {
            wordData[i - 1][0] = "1";
            wordData[i - 1][1] += `<li>வினைக்குறிப்பு எச்சமாக இருந்தால் வலி மிகும்</li>`;
            checkSandhiRules(i - 1, words, wordData);
            wordData[i - 1][4] = "2";
          }
          break;
        }
      }
    }

    // மகர ஈற்றுப் புணர்ச்சி (Makaram-ketta words - dropping 'm')
    if (wordData[i - 1][0] === "0") {
      for (const val of mviku) {
        if (prev.endsWith(val)) {
          wordData[i - 1][0] = "1";
          wordData[i - 1][1] += `<li>'${prev}ம்' என்ற சொல்லின் மகரம் கெடுவதால் ஒற்று மிகும்</li>`;
          wordData[i - 1][4] = "4";
          break;
        }
      }
    }

    // பெயரெச்சம் (Relative participles)
    if (wordData[i - 1][0] === "0" && wordData[i][4] !== "2") {
      for (const val of pecham) {
        const parts = val.split("|");
        if (prev.endsWith(parts[0])) {
          wordData[i - 1][2] += `<li>பெயரெச்சச் சொல் என்றால் வலிமிகாது</li>`;
          if (parts[1] === "") {
            if (wordData[i][4] === "1" || wordData[i][4] === "4") {
              wordData[i - 1][4] = "2";
            }
            wordData[i - 1][0] = " ";
            checkSandhiRules(i - 1, words, wordData);
          } else if (parts[1] === "0") {
            wordData[i - 1][0] = " ";
          } else if (parts[1] === "2" && wordData[i][4] === "4") {
            wordData[i - 1][0] = " ";
          }
          break;
        }
      }
    }

    // எதிர்மறைப் பெயரெச்சம் (Negative relative participles)
    if (wordData[i - 1][0] === "0") {
      for (const val of epecham) {
        const parts = val.split("|");
        if (prev.endsWith(parts[0])) {
          if (wordData[i][4] === "1" || wordData[i][4] === "4") {
            wordData[i - 1][0] = " ";
            wordData[i - 1][4] = "2";
          } else {
            wordData[i - 1][0] = parts[1] === "0" ? " " : "1";
          }
          wordData[i - 1][2] += `<li>எதிர்மறைப் பெயரெச்ச சொல்லென்றால் வலிமிகாது</li>`;
          break;
        }
      }
    }

    // ஈறுகெட்ட எதிர்மறைப் பெயரெச்சம் (Eeruketta ethirmarai peyaracham)
    if (wordData[i - 1][0] === "0") {
      if (prev.endsWith("ா")) {
        wordData[i - 1][0] = "1";
        wordData[i - 1][4] = "2";
        wordData[i - 1][1] += `<li>ஈறுகெட்ட எதிர்மறைப் பெயரெச்ச சொல்லென்றால் வலிமிகும்</li>`;
      }
    }
  }
}

// நீக்கப்பட்ட ஒற்றெழுத்து மாற்றங்களை இறுதிசெய்தல் (Resolve stripped sandhi)
function resolveStrippedSandhi(words: string[], wordData: string[][], isBoundary: boolean[]) {
  for (let i = 1; i < words.length - 1; i++) {
    if (isBoundary[i - 1]) continue;

    if (wordData[i - 1][5] === "1") {
      if (wordData[i - 1][0] === " ") {
        wordData[i - 1][0] = "-1";
      } else if (wordData[i - 1][0] === "1") {
        wordData[i - 1][0] = " ";
      } else if (wordData[i - 1][0] === "0") {
        wordData[i - 1][0] = " ";
      }
    }
  }
}


// ============================================================================
// பிரிவு 2: திணை மற்றும் பால் விதிகள் (Tinai and Paal Rules)
// ============================================================================

// திணை மற்றும் பால் சார்ந்த தரவுகள்
type GenderNumberPerson = 'male' | 'female' | 'honorific_sg' | 'honorific_pl' | 'neuter_sg' | 'neuter_pl' | '1st_sg' | '1st_pl' | '2nd_sg' | '2nd_pl';

const rationalPluralWords = ['குழந்தைகள்', 'பிள்ளைகள்', 'பெண்கள்', 'ஆண்கள்', 'மக்கள்'];

const maleWords = ['அண்ணன்', 'தம்பி', 'அப்பா', 'தந்தை', 'மகன்', 'தலைவன்', 'அரசன்', 'சிறுவன்', 'மாணவன்', 'ஆசிரியன்', 'ஆண்', 'அமைச்சன்', 'அமைச்சர்'];

const femaleWords = ['அம்மா', 'தாய்', 'மகள்', 'தலைவி', 'அரசி', 'சிறுமி', 'மாணவி', 'அக்கா', 'தங்கை', 'செல்வி', 'பெண்', 'ஆசிரியை'];

const commonVerbEndings = [
  'றேன்', 'தேன்', 'னேன்', 'பேன்', 'வேன்', 'ேன்',
  'றோம்', 'தோம்', 'னோம்', 'போம்', 'ோம்',
  'றீர்கள்', 'தீர்கள்', 'னீர்கள்', 'பீர்கள்', 'வீர்கள்', 'ீர்கள்',
  'றாய்', 'தாய்', 'னாய்', 'பாய்', 'வாய்', 'ாய்',
  'றான்', 'தான்', 'னான்', 'பான்', 'வான்', 'ான்',
  'றாள்', 'தாள்', 'னாள்', 'பாள்', 'வாள்', 'ாள்',
  'றார்', 'தார்', 'னார்', 'பார்', 'வார்', 'ார்',
  'றார்கள்', 'தார்கள்', 'னார்கள்', 'பார்கள்', 'வார்கள்', 'ார்கள்',
  'றது', 'தது', 'னது', 'பது', 'வது', 'து', 'ந்தது',
  'றன', 'தன', 'னன', 'பன', 'வன', 'ன', 'ந்தன'
];

const caseSuffixes = [
  'ஆல்', 'உடன்', 'ஓடு', 'ோடு', 'க்கு', 'கு', 'க்காக', 'இருந்து', 'லிருந்து', 'விட', 'விடவும்', 'உடைய', 'இல்', 'இடம்'
];

const bareConsonants = [
  'க', 'ங', 'ச', 'ஞ', 'ட', 'ண', 'த', 'ந', 'ப', 'ம', 'ய', 'ர', 'ல', 'வ', 'ழ', 'ள', 'ற', 'ன'
];

const nonSubjectWords = ['பற்றி', 'பற்றிய', 'குறித்து', 'ஆன', 'உள்ள', 'வந்த', 'சென்ற', 'பெரும்', 'சின்ன', 'அடுத்த', 'அதிக', 'மிக', 'மிகவும்'];

// எழுவாய் சொற்களைச் சீரமைத்தல் (மட்டும், தான், உம் போன்றவற்றை நீக்கி அடிப்படையைக் காணுதல்)
function normalizeSubjectWord(word: string): string {
  let w = word;

  // Strip "தான்", "மட்டும்", "கூட", "ஆவது"
  if (w.endsWith('தான்') && w.length > 4) w = w.slice(0, -4);
  if (w.endsWith('மட்டும்') && w.length > 6) w = w.slice(0, -6);
  if (w.endsWith('கூட') && w.length > 3) w = w.slice(0, -3);
  if (w.endsWith('ஆவது') && w.length > 5) w = w.slice(0, -5);

  // Strip "உம்" / "ஏ" / "ஓ" suffixes
  // 1. Plural / Honorific with suffix
  if (w.endsWith('களும்') || w.endsWith('களே') || w.endsWith('களோ')) {
    return w.slice(0, -5) + 'கள்';
  }
  if (w.endsWith('ர்களும்') || w.endsWith('ர்களே') || w.endsWith('ர்களோ')) {
    return w.slice(0, -6) + 'ர்கள்';
  }
  if (w.endsWith('பெரும்') || w.endsWith('பெரே') || w.endsWith('பெரோ')) {
    return w.slice(0, -5) + 'பர்';
  }
  
  // 2. Singular ending in U+0BB0 (ர) + vowel + ம் (e.g. அமைச்சரும் -> அமைச்சர்)
  if (w.endsWith('ரும்') || w.endsWith('ரே') || w.endsWith('ரோ')) {
    return w.slice(0, -3) + 'ர்';
  }
  // 3. Singular ending in U+0BA9 (ன) + vowel + ம் (e.g. அவனும் -> அவன்)
  if (w.endsWith('னும்') || w.endsWith('னே') || w.endsWith('னோ')) {
    return w.slice(0, -3) + 'ன்';
  }
  // 4. Singular ending in U+0BB3 (ள) + vowel + ம் (e.g. அவளும் -> அவள்)
  if (w.endsWith('ளும்') || w.endsWith('ளே') || w.endsWith('ளோ')) {
    return w.slice(0, -3) + 'ள்';
  }
  // 5. Singular ending in U+0BA4 (த) + vowel + ம் (e.g. அதுவும் -> அது)
  if (w.endsWith('தும்') || w.endsWith('தே') || w.endsWith('தோ')) {
    return w.slice(0, -3) + 'து';
  }
  
  // 6. Glides U+0BAF (ய) or U+0BB5 (ව)
  if (w.endsWith('யும்') || w.endsWith('யே') || w.endsWith('யோ')) {
    const base = w.slice(0, -3);
    if (base.endsWith('ி') || base.endsWith('ீ') || base.endsWith('ை')) {
      return base;
    }
    return base + '்';
  }
  if (w.endsWith('வும்') || w.endsWith('வே') || w.endsWith('வோ')) {
    return w.slice(0, -3);
  }

  return w;
}

// எழுவாயின் திணை, பால் மற்றும் எண் ஆகியவற்றைக் கண்டறிதல்
function getSubjectType(word: string): GenderNumberPerson | null {
  if (!word) return null;
  
  const cleanWord = normalizeSubjectWord(word);

  // 1. வினைச்சொற்களை எழுவாயாகக் கருதாமல் தவிர்த்தல்
  if (commonVerbEndings.some(ending => cleanWord.endsWith(ending) && cleanWord.length > ending.length)) {
    return null;
  }

  // 2. வேற்றுமை உருபுகள் ஏற்ற சொற்களைத் தவிர்த்தல் (எழுவாய் வேற்றுமை அல்லாதவை)
  if (caseSuffixes.some(suffix => cleanWord.endsWith(suffix) && cleanWord.length > suffix.length)) {
    return null;
  }
  
  // 3. அ-கராந்த பெயரெச்சங்கள் மற்றும் வினையெச்சங்களைத் தவிர்த்தல்
  if (bareConsonants.includes(cleanWord[cleanWord.length - 1])) {
    return null;
  }

  // 4. அறியப்பட்ட பெயரெச்ச/இடைச்சொற்களைத் தவிர்த்தல்
  if (nonSubjectWords.includes(cleanWord)) {
    return null;
  }

  // தன்மை, முன்னிலை இடப் பெயர்கள்
  if (cleanWord === 'நான்') return '1st_sg';
  if (cleanWord === 'நாம்' || cleanWord === 'நாங்கள்') return '1st_pl';
  if (cleanWord === 'நீ') return '2nd_sg';
  if (cleanWord === 'நீங்கள்') return '2nd_pl';

  // படர்க்கை இடப் பெயர்கள் (திணை, பால் பகுப்பு)
  if (cleanWord === 'அவன்' || cleanWord === 'இவன்' || cleanWord === 'எவன்') return 'male';
  if (cleanWord === 'அவள்' || cleanWord === 'இவள்' || cleanWord === 'எவள்') return 'female';
  if (cleanWord === 'அவர்' || cleanWord === 'இவர்' || cleanWord === 'எவர்') return 'honorific_sg';
  if (cleanWord === 'அவர்கள்' || cleanWord === 'இவர்கள்') return 'honorific_pl';
  if (cleanWord === 'அது' || cleanWord === 'இது' || cleanWord === 'எது' || cleanWord === 'அஃது' || cleanWord === 'இஃது') return 'neuter_sg';
  if (cleanWord === 'அவை' || cleanWord === 'இவை' || cleanWord === 'எவை') return 'neuter_pl';
  
  // உயர்திணைப் பன்மைச் சொற்கள் (விதிவிலக்குகள்)
  if (rationalPluralWords.includes(cleanWord)) return 'honorific_pl';

  // ஈற்றெழுத்து அடிப்படையில் திணை மற்றும் பால் அறிதல்
  if (cleanWord.endsWith('கள்')) {
    if (cleanWord.endsWith('ர்கள்') || cleanWord.endsWith('மார்கள்')) {
      return 'honorific_pl';
    }
    return 'neuter_pl';
  }
  if (cleanWord.endsWith('ர்')) {
    return 'honorific_sg';
  }
  if (cleanWord.endsWith('ன்')) {
    return 'male';
  }
  if (cleanWord.endsWith('ள்')) {
    return 'female';
  }
  
  if (maleWords.includes(cleanWord)) return 'male';
  if (femaleWords.includes(cleanWord)) return 'female';
  
  return 'neuter_sg';
}

// வினைமுற்றின் திணை, பால் மற்றும் எண் ஆகியவற்றைக் கண்டறிதல்
function getVerbType(word: string): GenderNumberPerson | null {
  if (!word) return null;
  
  if (word.endsWith('றேன்') || word.endsWith('தேன்') || word.endsWith('னேன்') || word.endsWith('பேன்') || word.endsWith('வேன்') || word.endsWith('ேன்')) {
    return '1st_sg';
  }
  if (word.endsWith('றோம்') || word.endsWith('தோம்') || word.endsWith('னோம்') || word.endsWith('போம்') || word.endsWith('ோம்')) {
    return '1st_pl';
  }
  if (word.endsWith('றீர்கள்') || word.endsWith('தீர்கள்') || word.endsWith('னீர்கள்') || word.endsWith('பீர்கள்') || word.endsWith('வீர்கள்') || word.endsWith('ீர்கள்')) {
    return '2nd_pl';
  }
  if (word.endsWith('றாய்') || word.endsWith('தாய்') || word.endsWith('னாய்') || word.endsWith('பாய்') || word.endsWith('வாய்') || word.endsWith('ாய்')) {
    return '2nd_sg';
  }
  if (word.endsWith('றான்') || word.endsWith('தான்') || word.endsWith('னான்') || word.endsWith('பான்') || word.endsWith('வான்') || word.endsWith('ான்')) {
    return 'male';
  }
  if (word.endsWith('றாள்') || word.endsWith('தாள்') || word.endsWith('னாள்') || word.endsWith('பாள்') || word.endsWith('வாள்') || word.endsWith('ாள்')) {
    return 'female';
  }
  if (word.endsWith('றார்கள்') || word.endsWith('தார்கள்') || word.endsWith('னார்கள்') || word.endsWith('பார்கள்') || word.endsWith('வார்கள்') || word.endsWith('ார்கள்') ||
      word.endsWith('ந்தனர்') || word.endsWith('ந்தார்கள்') || word.endsWith('னார்கள்') || word.endsWith('னர்') || word.endsWith('பவர்கள்') || word.endsWith('பவர்') || word.endsWith('இருக்கிறார்கள்')) {
    return 'honorific_pl';
  }
  if (word.endsWith('றார்') || word.endsWith('தார்') || word.endsWith('னார்') || word.endsWith('பார்') || word.endsWith('வார்') || word.endsWith('ார்')) {
    return 'honorific_sg';
  }
  if (word.endsWith('றது') || word.endsWith('தது') || word.endsWith('னது') || word.endsWith('பது') || word.endsWith('வது') || word.endsWith('து') || word.endsWith('ந்தது')) {
    return 'neuter_sg';
  }
  if (word.endsWith('றன') || word.endsWith('தன') || word.endsWith('னன') || word.endsWith('பன') || word.endsWith('வன') || word.endsWith('ன') || word.endsWith('ந்தன')) {
    return 'neuter_pl';
  }
  
  return null;
}

// திணை மற்றும் பால் இயைபிற்குத் தகுந்தாற்போல் வினைமுற்று விகுதியைச் திருத்துதல்
function correctVerbEnding(verb: string, targetType: GenderNumberPerson): string {
  const suffixes = [
    { suffix: 'கிறார்கள்', len: 9 },
    { suffix: 'கின்றன', len: 6 },
    { suffix: 'க்கிறது', len: 7 },
    { suffix: 'க்கிறது', len: 7 },
    { suffix: 'கிறது', len: 5 },
    { suffix: 'ார்கள்', len: 6 },
    { suffix: 'ீர்கள்', len: 6 },
    { suffix: 'ோர்கள்', len: 6 },
    { suffix: 'ந்தது', len: 5 },
    { suffix: 'ந்தன', len: 4 },
    { suffix: 'யது', len: 3 },
    { suffix: 'ான்', len: 3 },
    { suffix: 'ாள்', len: 3 },
    { suffix: 'ார்', len: 3 },
    { suffix: 'து', len: 2 },
    { suffix: 'ன', len: 1 },
    { suffix: 'ேன்', len: 3 },
    { suffix: 'ோம்', len: 3 },
    { suffix: 'ாய்', len: 3 }
  ];

  let matchedSuffix = null;
  for (const s of suffixes) {
    if (verb.endsWith(s.suffix)) {
      matchedSuffix = s;
      break;
    }
  }

  if (!matchedSuffix) return verb;

  const base = verb.slice(0, -matchedSuffix.len);
  const suffix = matchedSuffix.suffix;

  const isPresent = suffix.startsWith('கி');
  const isPastNthu = suffix.includes('ந்த') || suffix === 'ந்தது' || suffix === 'ந்தன';
  const isPastYathu = suffix === 'யது' || suffix === 'ன';

  if (isPresent) {
    const isStrong = suffix.includes('க்க');
    if (targetType === 'male') return base + (isStrong ? 'க்கிறான்' : 'கிறான்');
    if (targetType === 'female') return base + (isStrong ? 'க்கிறாள்' : 'கிறாள்');
    if (targetType === 'honorific_sg') return base + (isStrong ? 'க்கிறார்' : 'கிறார்');
    if (targetType === 'honorific_pl') return base + (isStrong ? 'க்கிறார்கள்' : 'கிறார்கள்');
    if (targetType === 'neuter_sg') return base + (isStrong ? 'க்கிறது' : 'கிறது');
    if (targetType === 'neuter_pl') return base + (isStrong ? 'க்கின்றன' : 'கின்றன');
    if (targetType === '1st_sg') return base + (isStrong ? 'க்கிறேன்' : 'கிறேன்');
    if (targetType === '1st_pl') return base + (isStrong ? 'க்கிறோம்' : 'கிறோம்');
    if (targetType === '2nd_sg') return base + (isStrong ? 'க்கிறாய்' : 'கிறாய்');
    if (targetType === '2nd_pl') return base + (isStrong ? 'க்கிறீர்கள்' : 'கிறீர்கள்');
  } else if (isPastNthu) {
    if (targetType === 'male') return base + 'ந்தான்';
    if (targetType === 'female') return base + 'ந்தாள்';
    if (targetType === 'honorific_sg') return base + 'ந்தார்';
    if (targetType === 'honorific_pl') return base + 'ந்தனர்';
    if (targetType === 'neuter_sg') return base + 'ந்தது';
    if (targetType === 'neuter_pl') return base + 'ந்தன';
    if (targetType === '1st_sg') return base + 'ந்தேன்';
    if (targetType === '1st_pl') return base + 'ந்தோம்';
    if (targetType === '2nd_sg') return base + 'ந்தாய்';
    if (targetType === '2nd_pl') return base + 'ந்தீர்கள்';
  } else if (isPastYathu) {
    if (targetType === 'male') return base + 'னான்';
    if (targetType === 'female') return base + 'னாள்';
    if (targetType === 'honorific_sg') return base + 'னார்';
    if (targetType === 'honorific_pl') return base + 'னர்';
    if (targetType === 'neuter_sg') return base + 'யது';
    if (targetType === 'neuter_pl') return base + 'ன';
    if (targetType === '1st_sg') return base + 'னேன்';
    if (targetType === '1st_pl') return base + 'னோம்';
    if (targetType === '2nd_sg') return base + 'னாய்';
    if (targetType === '2nd_pl') return base + 'னீர்கள்';
  } else {
    if (targetType === 'male') return base + 'ான்';
    if (targetType === 'female') return base + 'ாள்';
    if (targetType === 'honorific_sg') return base + 'ார்';
    if (targetType === 'honorific_pl') return base + 'ார்கள்';
    if (targetType === 'neuter_sg') return base + 'து';
    if (targetType === 'neuter_pl') return base + 'ன';
    if (targetType === '1st_sg') return base + 'ேன்';
    if (targetType === '1st_pl') return base + 'ோம்';
    if (targetType === '2nd_sg') return base + 'ாய்';
    if (targetType === '2nd_pl') return base + 'ீர்கள்';
  }
  return verb;
}

// திணை, பால், எண், இட இயைபு விதிகளைப் பயன்படுத்துதல் (Apply Subject-Verb Agreement)
function applySubjectVerbAgreement(cleanWords: string[], wordData: string[][], isBoundary: boolean[]) {
  const sentences: number[][] = [];
  let currentSentence: number[] = [];
  for (let i = 0; i < cleanWords.length; i++) {
    currentSentence.push(i);
    if (isBoundary[i] || i === cleanWords.length - 1) {
      sentences.push(currentSentence);
      currentSentence = [];
    }
  }

  for (const sentenceIndices of sentences) {
    if (sentenceIndices.length < 2) continue;

    let subjectIdx = -1;
    let subjectType: ReturnType<typeof getSubjectType> = null;

    for (const idx of sentenceIndices) {
      const word = cleanWords[idx];
      const type = getSubjectType(word);
      if (type !== null) {
        subjectIdx = idx;
        subjectType = type;
        break;
      }
    }

    const verbIdx = sentenceIndices[sentenceIndices.length - 1];
    const verbWord = cleanWords[verbIdx];
    const verbType = getVerbType(verbWord);

    if (subjectIdx !== -1 && verbType !== null && subjectType !== null) {
      if (subjectType !== verbType) {
        const correctVerb = correctVerbEnding(verbWord, subjectType);
        if (correctVerb !== verbWord) {
          wordData[verbIdx][0] = "2"; // மார்க்: இலக்கணப் பிழை (grammar-error)
          wordData[verbIdx][7] = correctVerb; // திருத்தப்பட்ட பரிந்துரை
          
          let reason = "";
          if (subjectType === "male") reason = `ஆண்பால் ஒருமை எழுவாய்க்குப் பின் (${cleanWords[subjectIdx]}) வினைமுற்று '${correctVerb}' என முடிய வேண்டும்.`;
          else if (subjectType === "female") reason = `பெண்பால் ஒருமை எழுவாய்க்குப் பின் (${cleanWords[subjectIdx]}) வினைமுற்று '${correctVerb}' என முடிய வேண்டும்.`;
          else if (subjectType === "honorific_sg") reason = `மதிப்புக்குரிய ஒருமை எழுவாய்க்குப் பின் (${cleanWords[subjectIdx]}) வினைமுற்று '${correctVerb}' என முடிய வேண்டும்.`;
          else if (subjectType === "honorific_pl") reason = `பலர்பால் / மதிப்புக்குரிய பன்மை எழுவாய்க்குப் பின் (${cleanWords[subjectIdx]}) வினைமுற்று '${correctVerb}' என முடிய வேண்டும்.`;
          else if (subjectType === "neuter_sg") reason = `ஒன்றன்பால் (அஃறிணை ஒருமை) எழுவாய்க்குப் பின் (${cleanWords[subjectIdx]}) வினைமுற்று '${correctVerb}' என முடிய வேண்டும்.`;
          else if (subjectType === "neuter_pl") reason = `பலவின்பால் (அஃறிணை பன்மை) எழுவாய்க்குப் பின் (${cleanWords[subjectIdx]}) வினைமுற்று '${correctVerb}' என முடிய வேண்டும்.`;
          else if (subjectType === "1st_sg") reason = `தன்மை ஒருமை எழுவாய்க்குப் பின் (${cleanWords[subjectIdx]}) வினைமுற்று '${correctVerb}' என முடிய வேண்டும்.`;
          else if (subjectType === "1st_pl") reason = `தன்மை பன்மை எழுவாய்க்குப் பின் (${cleanWords[subjectIdx]}) வினைமுற்று '${correctVerb}' என முடிய வேண்டும்.`;
          else if (subjectType === "2nd_sg") reason = `முன்னிலை ஒருமை எழுவாய்க்குப் பின் (${cleanWords[subjectIdx]}) வினைமுற்று '${correctVerb}' என முடிய வேண்டும்.`;
          else if (subjectType === "2nd_pl") reason = `முன்னிலை பன்மை எழுவாய்க்குப் பின் (${cleanWords[subjectIdx]}) வினைமுற்று '${correctVerb}' என முடிய வேண்டும்.`;

          wordData[verbIdx][3] += `<li>${reason}</li>`;
        }
      }
    }
  }
}


// ============================================================================
// பிரிவு 3: வேற்றுமை மற்றும் தொகை விதிகள் (Cases and Compounds Rules)
// ============================================================================

// வேற்றுமை உருபுகள் மற்றும் தொகைத் தரவுகள் (Cases and Compounds Datasets)
const vurubu2 = splitClean("ததை|1,சியை|1,ந்தியாவை|1,யினை|1,ற்றினை|1,த்தினை|1,ருப்பை|1,றுப்பை|1,ுப்பதை|1,சத்தை|1,பத்தை|1,தத்தை|1,ணத்தை|1,கத்தை|1,டத்தை|1,லத்தை|1,வத்தை|1,ளத்தை|1,வனை|1,ட்டதை|1,களை|1,ப்புகளை|1,க்குகளை|1,ச்சுகளை|1,ட்டுகளை|1,த்துகளை|1,ற்றுகளை|1,்வதை|1,ுவதை|1,ன்னதை|1,யத்தை|1,வளை|0,ர்களை|1,னத்தை|1,ற்றை|1,ங்களை|1,த்துகளை|1,களை|1,களை|1,ையை|1,வியை|1,ணியை|1,ழியை|1,ாரத்தை|1,ாட்டை|1,ண்ணை|1,ூணை|1,ை|1");
const vurubu2t = splitClean("பற்றி,போன்ற,போல,போல்,பற்றிய");
const vurubu3 = splitClean("ொடு,ோடு");
const vurubu4 = splitClean("கட்கு|1,கங்களுக்கு|1,னுக்கு|1,ைக்கு|1,ளுக்கு|1,தற்கு|1,த்திற்கு|1,க்காக|1,ற்றுக்கு|1,ிற்கு|1,குக்கு|1,லுக்கு|1,வுக்கு|1,விக்கு|1,துக்கு|1,வர்க்கு|1,வருக்கு|1,ிழுக்கு|1,க்கு|1,ாக|1");
const vurubu5 = splitClean("லிருந்து,னின்று,இருந்து,யிருந்து,மிருந்து");
const vurubu6 = splitClean("அது|,ஆது|,ரது|,யது|,னது|,ளது|,களது|");
const vurubu7 = splitClean("ில்,டை");

const vkutrlilu = splitClean("க்கு,ச்சு,ட்டு,த்து,ப்பு,ற்று");
const valli = splitClean("க,ச,ட,த,ப,ற");
const melli = splitClean("ங,ஞ,ந,ண,ம,ன");
const idai = splitClean("ய,ர,ல,வ,ழ,ள");

// வேற்றுமை மற்றும் தொகை விதிகளைப் பயன்படுத்துதல் (Apply Cases and Compounds Rules)
function applyCaseAndCompoundRules(words: string[], wordData: string[][], isBoundary: boolean[]) {
  for (let i = 1; i < words.length - 1; i++) {
    if (isBoundary[i - 1]) continue;

    const prev = words[i - 1];
    const curr = words[i];

    if (wordData[i - 1][0] === "0") {
      // 2 ஆம் வேற்றுமை உருபும் தொகையும்
      let vurubu2tFlag = "no";
      for (const val of vurubu2t) {
        if (wordData[i - 1][6] === "1" || !prev.endsWith("ை")) {
          vurubu2tFlag = "yes";
          if (val === curr) {
            wordData[i - 1][0] = " ";
            wordData[i - 1][2] += `<li>இரண்டாம் வேற்றுமைத் தொகை என்றால் வலிமிகாது</li>`;
            break;
          }
        }
      }

      if (wordData[i - 1][0] === "0" && vurubu2tFlag === "no") {
        for (const val of vurubu2) {
          const parts = val.split("|");
          if (prev.endsWith(parts[0]) && parts[0].length - 2 < prev.length) {
            wordData[i - 1][0] = parts[1] === "1" ? "1" : " ";
            wordData[i - 1][1] += `<li>இரண்டாம் வேற்றுமை விரியாக இருந்தால் வலிமிகும்</li>`;
            break;
          }
        }
      }
    }

    // 3 ஆம் வேற்றுமை
    if (wordData[i - 1][0] === "0") {
      for (const val of vurubu3) {
        if (prev.endsWith(val)) {
          wordData[i - 1][0] = " ";
          wordData[i - 1][2] += `<li>மூன்றாம் வேற்றுமை விரியாக இருந்தால் வலிமிகாது</li>`;
          checkSandhiRules(i - 1, words, wordData);
          break;
        }
      }
    }

    // 4 ஆம் வேற்றுமை
    if (wordData[i - 1][0] === "0") {
      for (const val of vurubu4) {
        const parts = val.split("|");
        if (prev.endsWith(parts[0])) {
          wordData[i - 1][0] = parts[1] === "1" ? "1" : " ";
          wordData[i - 1][1] += `<li>நான்காம் வேற்றுமை விரியாக இருந்தால் வலிமிகும்</li>`;
          break;
        }
      }
    }

    // 5 ஆம் வேற்றுமை
    if (wordData[i - 1][0] === "0") {
      for (const val of vurubu5) {
        if (prev.endsWith(val)) {
          wordData[i - 1][0] = " ";
          wordData[i - 1][2] += `<li>ஐந்தாம் வேற்றுமை விரியாக இருந்தால் வலிமிகாது</li>`;
          checkSandhiRules(i - 1, words, wordData);
          break;
        }
      }
    }

    // 6 ஆம் வேற்றுமை
    if (wordData[i - 1][0] === "0") {
      for (const val of vurubu6) {
        const parts = val.split("|");
        if (prev.endsWith(parts[0])) {
          wordData[i - 1][0] = " ";
          wordData[i - 1][2] += `<li>ஆறாம் வேற்றுமை விரியாக இருந்தால் வலிமிகாது</li>`;
          checkSandhiRules(i - 1, words, wordData);
          break;
        }
      }
    }

    // 7 ஆம் வேற்றுமை
    if (wordData[i - 1][0] === "0") {
      for (const val of vurubu7) {
        if (prev.endsWith(val)) {
          wordData[i - 1][0] = " ";
          wordData[i - 1][2] += `<li>ஏழாம் வேற்றுமை விரியாக இருந்தால் வலிமிகாது</li>`;
          break;
        }
      }
    }

    // வன்தொடர்க் குற்றியலுகரம்
    let vkutrliluFlag = "no";
    if (wordData[i - 1][0] === "0") {
      for (const val of vkutrlilu) {
        if (prev.endsWith(val)) {
          wordData[i - 1][0] = "1";
          wordData[i - 1][1] += `<li>வன்தொடர்க் குற்றியலுகரச் சொல்லென்றால் வலிமிகும்</li>`;
          vkutrliluFlag = "yes";
          break;
        }
      }
    }

    if (vkutrliluFlag === "no" && wordData[i - 1][0] === "0") {
      for (const v1 of valli) {
        for (const v2 of valli) {
          if (prev.endsWith(v1 + v2 + "்")) {
            wordData[i - 1][0] = " ";
            wordData[i - 1][2] += `<li>வல்லினம் தொடர்ந்து வந்த குற்றியலுகர வினைச்சொல்லென்றால் வலிமிகாது</li>`;
            break;
          }
        }
      }
    }

    // எழுவாய்த் தொடர் (வலிமிகா விதி)
    if (wordData[i - 1][0] === "0") {
      if (wordData[i][4] === "2" && wordData[i - 1][6] === "1") {
        wordData[i - 1][0] = " ";
        wordData[i - 1][2] += `<li>எழுவாய்த் தொடரென்றால் வலிமிகாது (${prev}- எழுவாய், ${curr}- பயனிலை)</li>`;
      }
    }

    // முற்றியலுகரம் (வட்டெழுத்து)
    const mutrilu = splitClean("கு,சு,டு,து,பு,று,ணு,மு,னு,யு,ரு,லு,வு,ழு");
    for (const val of mutrilu) {
      if (wordData[i - 1][0] === "0" && prev.length < 5) {
        if (prev.endsWith(val)) {
          wordData[i - 1][0] = " ";
          wordData[i - 1][1] += `<li>முற்றியலுகரமாக இருந்தால் வலிமிகாது</li>`;
          break;
        }
      }
    }
  }
}


// ============================================================================
// பிரிவு 4: மரபுப் பிழைகள் மற்றும் பிற விதிகள் (Traditional Rules & Others)
// ============================================================================

// மரபு மற்றும் வகைப்பாட்டுத் தரவுகள் (Traditional Rule Datasets)
const uyirmey = splitClean("ஓர்|ஒரு,ஈர்|இரு,அஃது|அது,இஃது|இது,அஃதாவது|அதாவது");
const speler = splitClean("க்கபட்ட|க்கப்பட்ட");
const oruword = splitClean("அ,ஆ,ஈ,ஊ,ஏ,ஓ,கா,கு,கூ,கை,கோ,சா,சீ,சே,சோ,டீ,தா,தீ,து,தூ,தெ,தை,நா,நீ,நூ,நை,நொ,நோ,பா,பீ,பு,பூ,பை,போ,மா,மீ,மு,மூ,மே,மை,யா,வா,வீ,வே,வை,வௌ");
const doudt = splitClean("நாட்டிய,விட்ட");
const vilasol = splitClean("தத்தை");

const ppeyar = splitClean("ட்சி,ரசு,ம்பு,ாளி,ஞர்,மிழ்,ச்சி,ற்சி,ணீர்,வறு,கார்,ங்,ஞ்,ட்,ண்,ந்,வ்,ழ்,ற்,ஸ்,ஷ்,ஜ்,ஹ்,அ,ஆ,இ,ஈ,உ,ஊ,எ,ஏ,ஐ,ஒ,ஓ,ஔ,ஃ,ம்,மை,வு,வி,ப்பு,ழக்கு,லக்கு,ளக்கு,பண்ணை,திண்ணை,எண்ணை,நடத்தை");
const peyar = splitClean("கை,ஞை,சை,டை,ணை,நை,பை,றை,னை,கத்தை,சத்தை,டத்தை,னத்தை,ணத்தை,தத்தை,நத்தை,பத்தை,மத்தை,யத்தை,ரத்தை,லத்தை,வத்தை,ழத்தை,ளத்தை,றத்தை,த்திலேயே,ில்,கத்தால்,யாக,பின்,போது,த்திற்கு,த்துக்கள்,த்துகள்,களுக்கு,களுக்கான,களுடன்,களே,களில்,ங்கள்,்களை");
const apeyar = splitClean("ம்,வ்வி,ுங்கள்,ததில்,ோம்,வையில்,வற்றில்,வற்றை,வனை,தாளி,ர்களுக்கு");
const venai = splitClean("றது,படும்,பட்ட,தலால்,ண்டால்,னால்,ந்தான்,ன்றான்,ண்டான்,ிறான்,படுத்த,வேண்டும்,றினார்,ுத்தால்,ுள்ளேன்,ள்ளார்,ட்டார்கள்,விட்டார்,பட்டார்,கின்றார்,பட்டது,விட்டது,ுவான்,றான்,னான்,ுங்கள்,கொண்டு,கிடையாது,தெரியாது,தலாக,தாக,மாக,ய்தேன்,த்தேன்,க்கேன்,ச்சேன்,ண்டேன்,ற்றேன்,ட்டேன்,ப்பேன்,ந்தேன்,கியது,தியது,டியது,போனது,றதும்,கிறோம்,கிறாய்,கியதும்,தியதும்,டியதும்,ட்டாலும்,்தாலும்,ற்றலும்,ிருந்த,கிறேன்,ண்டது,ன்னது,ந்தது,ப்பது,ய்வது,ள்வது,த்தது,ண்டதும்,ன்னதும்,ததும்,ப்பதும்,ய்வதும்,ள்வதும்,போனதும்,ிருக்கும்,ிருக்க,ிருந்தால்,ிருக்கு,கொள்ள,கொள்ளும்,்வோம்,கொண்டார்,்பவர்கள்,்பவர்,uபவர்க்கு,ிருக்கிறார்கள்,ிருக்கிறார்,ள்ளோம்,ய்ய,தாக,ானதே,ாகும்,ய்து,யலாம்,க்கலாம்,ள்ளலாம்,செல்லும்,வதற்கும்,வதற்கு,ாமல்,ணலாம்,கின்றன,முடியும்,ுமாறு,கூடாது,கொண்டே,கொண்ட,போனார்,ந்தார்,டன,ய்தன,த்தன,ய்தார்,ருந்தோம்");
const vppin = splitClean("தான்,கள்");

// சொற்களைப் பெயரிடல் / வகைப்படுத்துதல் (Noun / Verb Categorization Helper)
function categorizeWords(words: string[], wordData: string[][], isBoundary: boolean[]) {
  for (let i = 1; i < words.length - 1; i++) {
    if (isBoundary[i - 1]) continue;

    const prev = words[i - 1];

    if (wordData[i - 1][4] === "0") {
      for (const val of ppeyar) {
        if (prev.endsWith(val)) {
          wordData[i - 1][4] = "4";
          wordData[i - 1][6] = "1";
          break;
        }
      }
    }

    if (wordData[i - 1][4] === "0") {
      for (const val of peyar) {
        if (prev.endsWith(val)) {
          wordData[i - 1][4] = "4";
          break;
        }
      }
    }

    for (const val of apeyar) {
      if (prev.endsWith(val)) {
        wordData[i - 1][4] = "0";
        break;
      }
    }

    if (wordData[i - 1][4] === "0") {
      for (const val of venai) {
        if (prev.endsWith(val)) {
          wordData[i - 1][4] = "2";
          break;
        }
      }
    }

    if (wordData[i - 1][4] === "0") {
      for (const val of vppin) {
        if (prev.endsWith(val)) {
          for (const k of ppeyar) {
            if (prev.endsWith(k + val)) { wordData[i - 1][4] = "4"; break; }
          }
          if (wordData[i - 1][4] === "0") {
            for (const k of peyar) {
              if (prev.endsWith(k + val)) { wordData[i - 1][4] = "4"; break; }
            }
          }
          if (wordData[i - 1][4] === "0") {
            for (const k of venai) {
              if (prev.endsWith(k + val)) { wordData[i - 1][4] = "2"; break; }
            }
          }
          break;
        }
      }
    }
  }
}

// மரபுப் பிழைகள் மற்றும் புணர்ச்சி விதிகளைப் பயன்படுத்துதல் (Apply Traditional Rules)
function applyTraditionalRules(words: string[], cleanWords: string[], wordData: string[][], isBoundary: boolean[]) {
  for (let i = 1; i < words.length - 1; i++) {
    if (isBoundary[i - 1]) continue;

    const prev = words[i - 1];
    const curr = words[i];

    for (const val of uyirmey) {
      const parts = val.split("|");
      if (prev === parts[0] && mey.includes(curr[0])) {
        wordData[i - 1][0] = "2";
        wordData[i - 1][3] += `<li>\u0bae\u0bc6\u0baf\u0bcd\u0baf\u0bc6\u0bb4\u0bc1\u0ba4\u0bcd\u0ba4\u0bc1 \u0bb5\u0bbe\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0bc8\u0b95\u0bcd\u0b95\u0bc1 \u0bae\u0bc1\u0ba9\u0bcd '${parts[1]}' \u0b8e\u0ba9\u0bcd\u0bb1 \u0bb5\u0bbe\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0bc8\u0ba4\u0bbe\u0ba9\u0bcd \u0bb5\u0bb0 \u0bb5\u0bc7\u0ba3\u0bcd\u0b9b\u0bc1\u0bae\u0bcd</li>`;
      }
      if (prev === parts[1] && uyir.includes(curr[0])) {
        wordData[i - 1][0] = "2";
        wordData[i - 1][3] += `<li>\u0b81\u0baf\u0bbf\u0bb0\u0bc6\u0bb4\u0bc1\u0ba4\u0bcd\u0ba4\u0bc1 \u0bb5\u0bbe\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0bc8\u0b95\u0bcd\u0b95\u0bc1 \u0bae\u0bc1\u0ba9\u0bcd '${parts[0]}' \u0b8e\u0ba9\u0bcd\u0bb1 \u0bb5\u0bbe\u0bb0\u0bcd\u0ba4\u0bcd\u0ba4\u0bc8 \u0bb5\u0bb0\u0bc1\u0bb5\u0ba4\u0bc1 \u0bae\u0bb0\u0baa\u0bc1</li>`;
      }
    }
  }
}


// ============================================================================
// முதன்மைச் சரிபார்ப்பு இயக்கி (Main Check Engine Runner)
// ============================================================================

export function runTamilGrammarCheck(text: string): WordAnalysis[] {
  if (!text) return [];

  // Parse into words while keeping punctuation mapping
  const rawWords = text.trim().split(/\s+/);
  const cleanWords = rawWords.map(w => getCleanTamilWord(w));
  const words = [...cleanWords, "$$$$$"]; // padding

  // Find line boundary markers (newlines)
  let lastIndex = 0;
  const wordNewlines = new Array(rawWords.length).fill(false);
  for (let i = 0; i < rawWords.length; i++) {
    const word = rawWords[i];
    const wordIdx = text.indexOf(word, lastIndex);
    if (i > 0) {
      const betweenText = text.substring(lastIndex, wordIdx);
      if (betweenText.includes("\n") || betweenText.includes("\r")) {
        wordNewlines[i - 1] = true; // previous word ended a line
      }
    }
    lastIndex = wordIdx + word.length;
  }

  // Detect boundaries: punctuation ends, punctuation starts, newlines
  const hasPunctuationEnd = /[0-9.,?!;:""''“’‘()\[\]{}=+\-*%#@$&~\/]+$/;
  const hasPunctuationStart = /^[0-9.,?!;:""''“’‘()\[\]{}=+\-*%#@$&~\/]+/;
  
  const isBoundary = new Array(words.length).fill(false);
  for (let i = 1; i < words.length - 1; i++) {
    const prevRaw = rawWords[i - 1];
    const currRaw = rawWords[i];
    
    if (wordNewlines[i - 1] || hasPunctuationEnd.test(prevRaw) || hasPunctuationStart.test(currRaw)) {
      isBoundary[i - 1] = true;
    }
  }

  const wordData: string[][] = Array.from({ length: words.length }, () => [
    "0",  // 0: status flag ("1" = add sandhi, "-1" = del sandhi, "2" = grammar error, " " = correct)
    "",   // 1: reason for yes (sandhi matches)
    "",   // 2: reason for no
    "",   // 3: traditional grammar reasoning
    "0",  // 4: category flag ("4" = noun, "2" = verb)
    " ",  // 5: stripped sandhi flag ("1" = sandhi was stripped)
    "0",  // 6: intermediate
    ""    // 7: custom suggestion (if any)
  ]);

  // Strip existing sandhi consonants
  for (let i = 1; i < words.length; i++) {
    const prevWord = words[i - 1];
    const currWord = words[i];
    
    if (prevWord.length > 2 && prevWord.endsWith(String.fromCharCode(3021))) {
      const prevCons = prevWord[prevWord.length - 2];
      const nextCons = currWord[0];
      
      const isMatch = (nextCons === String.fromCharCode(2965) && prevCons === String.fromCharCode(2965)) || // க் + க
                      (nextCons === String.fromCharCode(2970) && prevCons === String.fromCharCode(2970)) || // ச் + ச
                      (nextCons === String.fromCharCode(2980) && prevCons === String.fromCharCode(2980)) || // த் + த
                      (nextCons === String.fromCharCode(2986) && prevCons === String.fromCharCode(2986));   // ப் + ப
      if (isMatch) {
        words[i - 1] = prevWord.slice(0, -2);
        wordData[i - 1][5] = "1";
      }
    }
  }

  // --- இலக்கண விதிப் பிரிவுகள் (Grammar Rule Sections Execution) ---

  // 1. சொற்களைப் பெயரிடல் / வகைப்படுத்துதல் (Noun / Verb Categorization)
  categorizeWords(words, wordData, isBoundary);

  // 2. சந்திப் பிழை விதிகள் - வலிமிகும்/வலிமிகாத இடங்கள் (Sandhi Rules)
  applySandhiRules(words, wordData, isBoundary, rawWords);

  // 3. வேற்றுமை மற்றும் தொகை விதிகள் (Cases and Compounds)
  applyCaseAndCompoundRules(words, wordData, isBoundary);

  // 4. மரபுப் பிழைகள் மற்றும் புணர்ச்சி விதிகள் (Traditional Rules)
  applyTraditionalRules(words, cleanWords, wordData, isBoundary);

  // 5. நீக்கப்பட்ட ஒற்றெழுத்து மாற்றங்களை இறுதிசெய்தல் (Resolve stripped sandhi)
  resolveStrippedSandhi(words, wordData, isBoundary);

  // 6. திணை, பால், எண், இட இயைபு விதிகள் (Subject-Verb Agreement)
  applySubjectVerbAgreement(cleanWords, wordData, isBoundary);

  // கடைசி வார்த்தைக்கு வலிமிகாது விதி
  wordData[words.length - 2][2] = "<li>கடைசி வார்த்தைக்கு வலிமிகாது</li>";

  // Build final analysis result
  const analysis: WordAnalysis[] = [];
  for (let i = 0; i < rawWords.length; i++) {
    const statusVal = wordData[i][0].trim();
    let status: WordAnalysis['status'] = 'correct';
    let suggestion: string | undefined = undefined;
    const reasons: string[] = [];

    if (wordData[i][1]) reasons.push(wordData[i][1]);
    if (wordData[i][2]) reasons.push(wordData[i][2]);
    if (wordData[i][3]) reasons.push(wordData[i][3]);

    const original = rawWords[i];
    const cleaned = cleanWords[i];
    const nextWord = cleanWords[i + 1] || "";

    if (statusVal === "1") {
      status = 'grammar-add';
      const sandhiChar = nextWord[0] || "";
      if (sandhiChar) {
        suggestion = original + sandhiChar + String.fromCharCode(3021);
      }
    } else if (statusVal === "-1") {
      status = 'grammar-del';
      suggestion = original.slice(0, -2);
    } else if (statusVal === "2") {
      status = 'grammar-error';
      if (wordData[i][7]) {
        suggestion = wordData[i][7];
      } else {
        for (const val of uyirmey) {
          const parts = val.split("|");
          if (cleaned === parts[0]) suggestion = parts[1];
          if (cleaned === parts[1]) suggestion = parts[0];
        }
      }
    }

    const cleanReasons = reasons
      .flatMap(r => r.split("</li>"))
      .map(r => r.replace(/<[^>]*>/g, "").trim())
      .filter(r => r.length > 0);

    analysis.push({
      index: i,
      original,
      cleaned,
      status,
      suggestion,
      reasons: cleanReasons
    });
  }

  return analysis;
}
