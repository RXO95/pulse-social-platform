"""
Post-Model Refinement Layer for Indian Language NER

This module reclassifies and discovers entities WITHOUT retraining the model.
It uses gazetteers, suffix patterns, context windows, and heuristic rules
tuned heavily for Hindi, Hinglish, Marathi, and Indian English text.

Strategy:
  1. RECLASSIFY  — fix model mistakes (e.g. "Ram Mandir" ORG → LOC)
  2. DISCOVER    — catch entities the model missed entirely
  3. MERGE       — deduplicate and pick highest-confidence label
  4. BOOST       — adjust confidence scores based on evidence strength
"""

import re
from typing import List, Dict, Optional, Tuple


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 1: GAZETTEERS  (exact / lowercase match)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# --- Temples, Mosques, Gurudwaras, Churches, Monuments → LOC ---
RELIGIOUS_AND_MONUMENT_LOC = {
    # Temples
    "ram mandir", "ram temple", "ayodhya mandir", "somnath temple",
    "somnath mandir", "kashi vishwanath", "kashi vishwanath temple",
    "kashi vishwanath mandir", "meenakshi temple", "meenakshi amman temple",
    "tirupati temple", "tirupati balaji", "tirumala temple",
    "akshardham", "akshardham temple", "akshardham mandir",
    "jagannath temple", "jagannath mandir", "puri mandir",
    "siddhivinayak", "siddhivinayak temple", "siddhivinayak mandir",
    "mahakaleshwar temple", "mahakaleshwar mandir", "mahakal temple",
    "kedarnath temple", "kedarnath mandir", "kedarnath dham",
    "badrinath temple", "badrinath mandir", "badrinath dham",
    "vaishno devi", "vaishno devi temple", "vaishno devi mandir",
    "golden temple", "harmandir sahib", "darbar sahib",
    "birla mandir", "birla temple", "iskcon temple", "iskcon mandir",
    "lingaraj temple", "konark temple", "sun temple konark",
    "brihadeeswara temple", "thanjavur temple",
    "padmanabhaswamy temple", "sabarimala", "sabarimala temple",
    "shirdi temple", "shirdi sai baba temple",
    "mahabodhi temple", "mahabodhi mandir",
    "dwarkadhish temple", "dwarka mandir",
    "lotus temple", "chhatarpur temple", "chhatarpur mandir",
    "pashupatinath temple", "pashupatinath mandir",
    "ramanathaswamy temple", "rameshwaram temple",
    "amarnath temple", "amarnath cave", "amarnath yatra",
    # Multi-word temple variants (English)
    "ayodhya shri ram temple", "ayodhya shri ram mandir",
    "shri ram temple", "shri ram mandir",
    "ayodhya ram temple", "ayodhya ram mandir",

    # Mosques
    "jama masjid", "mecca masjid", "haji ali", "haji ali dargah",
    "charminar masjid", "taj ul masjid", "fatehpuri masjid",
    "bara imambara", "chhota imambara",

    # Gurudwaras
    "bangla sahib", "gurudwara bangla sahib", "sis ganj sahib",
    "gurudwara sis ganj", "patna sahib gurudwara",
    "hemkund sahib", "anandpur sahib",

    # Churches
    "basilica of bom jesus", "se cathedral", "san thome basilica",
    "velankanni church", "medak church",

    # Monuments & historical LOC
    "taj mahal", "qutub minar", "qutb minar", "red fort",
    "lal qila", "india gate", "gateway of india",
    "hawa mahal", "charminar", "golconda fort", "golkonda fort",
    "amer fort", "amber fort", "agra fort", "mehrangarh fort",
    "jaisalmer fort", "mysore palace", "city palace",
    "victoria memorial", "howrah bridge", "marine drive",
    "juhu beach", "gateway of india", "char minar",
    "humayun tomb", "humayuns tomb", "jantar mantar",
    "fatehpur sikri", "ajanta caves", "ellora caves",
    "elephanta caves", "hampi", "khajuraho", "sanchi stupa",
    "konark sun temple", "sun temple",
    "wagah border", "attari border",

    # Dargahs / Shrines
    "ajmer sharif", "ajmer dargah", "nizamuddin dargah",
    "nizamuddin auliya", "dargah sharif",

    # ── Devanagari temples / monuments ──
    "राम मंदिर", "श्री राम मंदिर", "अयोध्या श्री राम मंदिर",
    "अयोध्या राम मंदिर", "अयोध्या मंदिर",
    "सोमनाथ मंदिर", "काशी विश्वनाथ मंदिर", "काशी विश्वनाथ",
    "मीनाक्षी मंदिर", "तिरुपति मंदिर", "तिरुपति बालाजी",
    "अक्षरधाम मंदिर", "अक्षरधाम",
    "जगन्नाथ मंदिर", "सिद्धिविनायक मंदिर", "सिद्धिविनायक",
    "महाकालेश्वर मंदिर", "केदारनाथ मंदिर", "केदारनाथ धाम",
    "बद्रीनाथ मंदिर", "बद्रीनाथ धाम",
    "वैष्णो देवी मंदिर", "वैष्णो देवी",
    "स्वर्ण मंदिर", "हरमंदिर साहिब", "दरबार साहिब",
    "बिरला मंदिर", "इस्कॉन मंदिर",
    "ताज महल", "लाल किला", "इंडिया गेट",
    "कुतुब मीनार", "हवा महल", "चारमीनार",
    "गेटवे ऑफ इंडिया",
    "अजमेर दरगाह", "निज़ामुद्दीन दरगाह",
    "जामा मस्जिद", "मक्का मस्जिद",
}

# --- Indian cities, states, regions, landmarks → LOC ---
INDIAN_LOCATIONS = {
    # Metro cities
    "mumbai", "delhi", "new delhi", "bangalore", "bengaluru",
    "hyderabad", "chennai", "kolkata", "pune", "ahmedabad",
    "jaipur", "lucknow", "kanpur", "nagpur", "indore",
    "thane", "bhopal", "visakhapatnam", "vizag", "patna",
    "vadodara", "ghaziabad", "ludhiana", "agra", "nashik",
    "faridabad", "meerut", "rajkot", "varanasi", "srinagar",
    "aurangabad", "dhanbad", "amritsar", "navi mumbai",
    "allahabad", "prayagraj", "ranchi", "howrah", "coimbatore",
    "jabalpur", "gwalior", "vijayawada", "jodhpur", "madurai",
    "raipur", "kota", "chandigarh", "guwahati", "solapur",
    "noida", "gurgaon", "gurugram", "trivandrum", "thiruvananthapuram",
    "jammu", "dehradun", "shimla", "manali", "darjeeling",
    "gangtok", "imphal", "shillong", "aizawl", "kohima",
    "itanagar", "agartala", "panaji", "pondicherry", "puducherry",
    "mysuru", "mysore", "mangalore", "mangaluru", "hubli",
    "belgaum", "belagavi",

    # States & UTs
    "maharashtra", "karnataka", "tamil nadu", "telangana",
    "andhra pradesh", "kerala", "gujarat", "rajasthan",
    "uttar pradesh", "madhya pradesh", "west bengal",
    "bihar", "odisha", "punjab", "haryana", "jharkhand",
    "chhattisgarh", "uttarakhand", "himachal pradesh",
    "assam", "goa", "tripura", "meghalaya", "manipur",
    "mizoram", "nagaland", "arunachal pradesh", "sikkim",
    "jammu and kashmir", "jammu kashmir", "ladakh",
    "lakshadweep", "andaman", "andaman and nicobar",
    "dadra and nagar haveli", "daman and diu",

    # Regions / areas
    "kashmir", "konkan", "vidarbha", "marathwada",
    "bundelkhand", "malabar", "coromandel", "deccan",
    "doab", "thar", "sundarbans", "kutch", "rann of kutch",
    "western ghats", "eastern ghats", "siachen",
    "nubra valley", "spiti valley", "lahaul",

    # Rivers (often mentioned in Indian social media)
    "ganga", "yamuna", "godavari", "krishna river",
    "narmada", "brahmaputra", "kaveri", "cauvery",
    "chambal", "sabarmati", "mahanadi", "tungabhadra",

    # Key landmarks
    "ayodhya", "mathura", "vrindavan", "haridwar",
    "rishikesh", "bodh gaya", "bodhgaya", "sarnath",
    "ujjain", "pushkar", "dwarka", "puri", "rameswaram",
    "rameshwaram", "amritsar", "varanasi", "kashi",
    "tirupati", "shirdi", "sabarimala",

    # Common Hinglish spellings
    "dilli", "bambai", "calcutta", "madras", "bombay",
    "benares", "banaras",

    # Countries that come up a lot in Indian context
    "pakistan", "china", "nepal", "sri lanka", "bangladesh",
    "bhutan", "afghanistan",

    # Hindi / Devanagari — Cities
    "मुंबई", "दिल्ली", "नई दिल्ली", "पुणे", "जयपुर", "लखनऊ",
    "अयोध्या", "काशी", "हरिद्वार", "ऋषिकेश", "मथुरा",
    "वृन्दावन", "वाराणसी", "हैदराबाद", "अहमदाबाद", "बेंगलुरु",
    "कोलकाता", "चेन्नई", "भोपाल", "इंदौर",
    "नागपुर", "कानपुर", "ठाणे", "सूरत", "विशाखापत्तनम",
    "अमृतसर", "श्रीनगर", "रांची", "गुवाहाटी", "देहरादून",
    "शिमला", "जम्मू", "पटना", "चंडीगढ़",
    "कुपवाड़ा", "मैनपुरी", "जोधपुर", "उज्जैन", "द्वारका",
    "पुरी", "रामेश्वरम", "तिरुपति", "शिर्डी",

    # Hindi / Devanagari — States & UTs
    "राजस्थान", "गुजरात", "महाराष्ट्र", "कर्नाटक",
    "केरल", "तमिलनाडु", "कश्मीर",
    "उत्तर प्रदेश", "मध्य प्रदेश", "हिमाचल प्रदेश",
    "आंध्र प्रदेश", "अरुणाचल प्रदेश",
    "पश्चिम बंगाल", "बिहार", "ओडिशा", "पंजाब",
    "हरियाणा", "झारखंड", "छत्तीसगढ़", "उत्तराखंड",
    "असम", "गोवा", "त्रिपुरा", "मेघालय", "मणिपुर",
    "मिज़ोरम", "नागालैंड", "सिक्किम", "लद्दाख",
    "जम्मू और कश्मीर", "जम्मू कश्मीर",

    # Hindi / Devanagari — Regions & Rivers
    "गंगा", "यमुना", "गोदावरी", "नर्मदा",
    "ब्रह्मपुत्र", "कावेरी", "सरस्वती",
    "कोंकण", "विदर्भ", "मराठवाडा",

    # Hindi / Devanagari — Countries
    "भारत", "पाकिस्तान", "चीन", "नेपाल",
    "श्रीलंका", "बांग्लादेश", "अफ़ग़ानिस्तान",
}

# --- Political parties, orgs, companies → ORG ---
INDIAN_ORGS = {
    # Political parties
    "bjp", "bharatiya janata party", "congress", "inc",
    "indian national congress", "aap", "aam aadmi party",
    "shiv sena", "shivsena", "shiv sena ubt", "shiv sena (ubt)",
    "ncp", "nationalist congress party", "tmc", "trinamool",
    "trinamool congress", "dmk", "aiadmk", "admk",
    "bsp", "bahujan samaj party", "sp", "samajwadi party",
    "rjd", "rashtriya janata dal", "jdu", "janata dal united",
    "jd(u)", "jd(s)", "janata dal secular",
    "cpim", "cpi(m)", "cpi", "communist party",
    "mns", "maharashtra navnirman sena",
    "ysrcp", "ysr congress", "brs", "bharat rashtra samithi",
    "trs", "telangana rashtra samithi", "jmm", "jharkhand mukti morcha",
    "akali dal", "sad", "shiromani akali dal",
    "rss", "rashtriya swayamsevak sangh",
    "vhp", "vishwa hindu parishad", "bajrang dal",

    # Government bodies
    "isro", "drdo", "barc", "bhabha atomic research centre",
    "sebi", "rbi", "reserve bank of india",
    "niti aayog", "niti ayog", "election commission",
    "supreme court", "high court", "lok sabha", "rajya sabha",
    "parliament", "pmo", "ncert", "ugc", "cbse", "icse",
    "iit", "iim", "aiims", "nit",

    # Companies / brands
    "tata", "tata group", "tata motors", "tata steel",
    "tata consultancy services", "tcs", "infosys", "wipro",
    "reliance", "reliance industries", "reliance jio", "jio",
    "adani", "adani group", "adani ports", "adani power",
    "mahindra", "mahindra group", "tech mahindra",
    "hindustan unilever", "hdfc", "hdfc bank", "icici",
    "icici bank", "sbi", "state bank of india",
    "bajaj", "bajaj auto", "bajaj finance",
    "larsen and toubro", "l&t", "godrej", "birla",
    "aditya birla", "vedanta", "jsw", "jsw steel",
    "zee", "zee news", "zee entertainment",
    "times of india", "hindustan times", "ndtv",
    "republic", "republic tv", "aaj tak", "abp news",
    "india today", "the hindu", "indian express",
    "economic times", "mint", "business standard",
    "ola", "paytm", "zomato", "swiggy", "flipkart",
    "myntra", "nykaa", "byju", "byjus",
    "unacademy", "razorpay", "cred", "dream11",
    "phonepe", "bharat pe", "bharatpe",
    "ipl", "bcci", "indian premier league",
    "psl", "asia cup", "icc",

    # Defence / Security
    "indian army", "indian navy", "indian air force",
    "bsf", "crpf", "cisf", "itbp", "nsg", "raw",
    "nia", "cbi", "enforcement directorate", "ed",

    # Hindi / Devanagari — Parties
    "भाजपा", "कांग्रेस", "आप", "शिवसेना",
    "राकांपा", "बसपा", "सपा", "राजद",
    "आरएसएस", "इसरो", "आरबीआई",

    # Hindi / Devanagari — Government / institutions
    "लोकसभा", "राज्यसभा", "संसद",
    "लोकसभा सचिवालय", "राज्यसभा सचिवालय",
    "चुनाव आयोग", "सर्वोच्च न्यायालय", "उच्च न्यायालय",
    "नीति आयोग",

    # Hindi / Devanagari — Defence / Security
    "भारतीय सेना", "भारतीय वायुसेना", "भारतीय नौसेना",
    "भारतीय थल सेना",
    "सीमा सुरक्षा बल", "केंद्रीय रिजर्व पुलिस बल",

    # Hindi / Devanagari — Sarkar (government bodies identified by name)
    "उत्तर प्रदेश सरकार", "मध्य प्रदेश सरकार",
    "महाराष्ट्र सरकार", "केंद्र सरकार",
    "राजस्थान सरकार", "बिहार सरकार",
}

# --- Well-known Indian person names → PER ---
INDIAN_PERSONS = {
    # Politicians
    "narendra modi", "modi ji", "modiji", "pm modi",
    "rahul gandhi", "sonia gandhi", "priyanka gandhi",
    "amit shah", "rajnath singh", "nitin gadkari",
    "yogi adityanath", "yogi ji", "yogiji",
    "arvind kejriwal", "kejriwal",
    "mamata banerjee", "mamata didi",
    "uddhav thackeray", "uddhav", "raj thackeray",
    "akhilesh yadav", "mayawati", "lalu yadav",
    "lalu prasad", "nitish kumar",
    "sharad pawar", "pawar saheb", "ajit pawar",
    "eknath shinde", "devendra fadnavis", "fadnavis",
    "mk stalin", "stalin", "karunanidhi",
    "jagan mohan reddy", "jagan", "chandrababu naidu",
    "kcr", "k chandrashekar rao", "revanth reddy",
    "naveen patnaik", "hemant soren",
    "bhagwant mann", "siddaramaiah", "dk shivakumar",
    "ashok gehlot", "vasundhara raje",
    "smriti irani", "nirmala sitharaman",
    "s jaishankar", "jaishankar",

    # Cricket
    "virat kohli", "kohli", "sachin tendulkar", "sachin",
    "ms dhoni", "dhoni", "msd", "rohit sharma", "rohit",
    "jasprit bumrah", "bumrah", "hardik pandya",
    "rishabh pant", "kl rahul", "shubman gill",
    "ravindra jadeja", "jadeja", "ashwin", "r ashwin",
    "suryakumar yadav", "sky", "mohammed shami", "shami",
    "ishan kishan", "shreyas iyer", "siraj",

    # Bollywood
    "shah rukh khan", "shahrukh khan", "srk",
    "salman khan", "aamir khan", "amitabh bachchan",
    "ranveer singh", "ranbir kapoor", "akshay kumar",
    "ajay devgn", "hrithik roshan", "tiger shroff",
    "deepika padukone", "alia bhatt", "priyanka chopra",
    "katrina kaif", "kareena kapoor", "anushka sharma",
    "kangana ranaut", "taapsee pannu", "kiara advani",
    "vijay", "thalapathy vijay", "rajinikanth", "rajini",
    "kamal haasan", "prabhas", "allu arjun", "ram charan",
    "ntr", "jr ntr", "mahesh babu", "yash",

    # Business
    "mukesh ambani", "ambani", "gautam adani",
    "ratan tata", "anand mahindra", "nandan nilekani",
    "narayana murthy", "sundar pichai", "satya nadella",

    # Historical
    "mahatma gandhi", "gandhiji", "nehru", "jawaharlal nehru",
    "sardar patel", "vallabhbhai patel", "subhash chandra bose",
    "bhagat singh", "ambedkar", "dr ambedkar", "babasaheb",
    "shivaji", "chhatrapati shivaji", "shivaji maharaj",
    "rani laxmibai", "rani lakshmibai", "tipu sultan",

    # Hindi / Devanagari — People
    "मोदी", "राहुल गांधी", "अमित शाह", "योगी",
    "केजरीवाल", "ममता", "फडणवीस", "पवार",
    "शिंदे", "ठाकरे", "विराट कोहली", "धोनी",
    "सचिन", "शाहरुख", "अमिताभ",
    "श्रेयस तलपड़े", "श्रेयस",

    # Hindi / Devanagari — Deities (tagged as PER)
    "शिव", "शिवजी", "महादेव", "शंकर",
    "विष्णु", "कृष्ण", "श्रीकृष्ण", "राम", "श्रीराम",
    "हनुमान", "गणेश", "गणपति",
    "दुर्गा", "पार्वती", "लक्ष्मी", "सरस्वती",
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 2: SUFFIX / PATTERN RULES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# If an entity's text ENDS with any of these → force LOC
LOC_SUFFIXES = [
    # Religious structures (Hindi/English)
    "mandir", "temple", "masjid", "mosque", "gurudwara", "gurdwara",
    "church", "dargah", "shrine", "basilica", "cathedral", "math",
    "matha", "akhara", "ashram", "ashrama", "kovil",
    "मंदिर", "मस्जिद", "गुरुद्वारा", "चर्च", "दरगाह", "आश्रम",

    # Forts, palaces, monuments
    "fort", "qila", "palace", "mahal", "bhavan", "bhawan",
    "sthal", "sthan", "smarak", "memorial", "monument",
    "किला", "महल", "भवन", "स्मारक",

    # Geographic (English)
    "nagar", "pur", "puram", "abad", "ganj", "garh",
    "palli", "pally", "pura", "wadi", "wada", "gaon",
    "khurd", "kalan", "ghat", "hills", "hill", "island",
    "islands", "valley", "lake", "beach", "falls", "cave",
    "caves", "dam", "bridge", "chowk", "bazaar", "bazar",
    "marg", "road", "path", "gali", "street", "border",
    "pradesh",  # Uttar Pradesh, Madhya Pradesh etc.

    # Geographic (Hindi)
    "नगर", "पुर", "गंज", "गढ़", "घाट", "द्वीप",
    "प्रदेश",  # उत्तर प्रदेश, मध्य प्रदेश etc.

    # Dham / pilgrimage
    "dham", "tirth", "tirtha", "kshetra", "sarovar",
    "kund", "sangam",
    "धाम", "तीर्थ", "क्षेत्र", "सरोवर", "कुंड", "संगम",
]

# If an entity's text ENDS with any of these → force ORG
ORG_SUFFIXES = [
    # Political
    "party", "dal", "sabha", "sena", "parishad", "morcha",
    "samiti", "sangathan", "sangh", "samaj", "front",
    "congress", "alliance", "coalition", "movement",
    "पार्टी", "दल", "सेना", "परिषद", "मोर्चा",
    "समिति", "संगठन", "संघ", "समाज",
    "सचिवालय",  # Sachivalaya = Secretariat
    "सरकार",    # Sarkar = Government
    "मंत्रालय",  # Mantralaya = Ministry
    "आयोग",     # Aayog = Commission

    # Corporate / institutional
    "limited", "ltd", "pvt", "inc", "llp", "corp",
    "corporation", "industries", "enterprise", "enterprises",
    "group", "holdings", "foundation", "trust",
    "bank", "finance", "insurance",
    "university", "institute", "college", "academy",
    "board", "commission", "authority", "tribunal",
    "council", "committee", "association", "federation",
    "union", "league",
    "लिमिटेड", "उद्योग", "संस्थान", "विश्वविद्यालय",
    "बैंक", "प्राधिकरण",

    # Media
    "news", "times", "tv", "media", "daily",
    "post", "herald", "gazette", "express",
]

# If an entity's text ENDS with any of these → force PER
PER_SUFFIXES = [
    "ji", "saheb", "sahab", "didi", "bhai", "bhaiya",
    "anna", "amma", "chacha", "mama", "dada",
    "bapu", "maharaj", "swami",
    "जी", "साहेब", "दीदी", "भाई", "बापू", "स्वामी",
]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 3: CONTEXT WINDOW CLUES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Words near an entity that suggest PERSON
PERSON_CONTEXT = {
    "met", "meet", "meeting", "said", "says", "told", "asked",
    "announced", "spoke", "speaks", "addressed", "born",
    "died", "married", "wife", "husband", "son", "daughter",
    "father", "mother", "brother", "sister", "family",
    "photo", "selfie", "clicked", "spotted", "seen",
    "ne kaha", "bole", "boli", "bolein", "kehte",
    "mila", "mili", "mile", "milein",
    "sir", "madam", "uncle", "aunty", "bhaiya",
}

# Words near an entity that suggest LOCATION
LOCATION_CONTEXT = {
    "visited", "visit", "travel", "travelling", "trip",
    "went", "going", "reached", "reach", "arrived",
    "flew", "flight", "train", "bus", "road",
    "highway", "near", "nearby", "from", "in", "at",
    "gaya", "gayi", "gaye", "pahuncha", "pahunche",
    "ghumne", "ghoom", "ghumna", "yatra", "safar",
    "located", "situated", "built", "constructed",
    "inaugurated", "demolished", "restoration",
    "area", "district", "region", "zone", "sector",
}

# Words near an entity that suggest ORGANIZATION
ORG_CONTEXT = {
    "company", "startup", "firm", "govt", "government",
    "agency", "ministry", "department",
    "announced", "launched", "released", "filed",
    "policy", "scheme", "yojana",
    "won", "lost", "election", "elections", "vote",
    "votes", "seat", "seats", "majority", "coalition",
    "profit", "loss", "revenue", "shares", "stock",
    "ipo", "market", "listed",
    "team", "club", "squad", "franchise",
    "sarkar", "sarkaar", "mantralaya",
}

# Words that should NOT be treated as entities (Hindi/Hinglish function words
# and common nouns that happen to be capitalized at sentence start)
STOP_WORDS = {
    # Hindi function words (romanized)
    "maine", "mujhe", "mera", "meri", "mere",
    "humne", "humko", "humara", "humari",
    "tumne", "tumko", "tumhara", "tumhari",
    "usne", "uska", "uski", "uske",
    "unka", "unki", "unke", "unhe",
    "yeh", "woh", "yaha", "waha", "yahaan", "wahaan",
    "kya", "kaise", "kab", "kaha", "kyun", "kaun",
    "aur", "lekin", "magar", "par", "toh", "bhi",
    "hai", "hain", "tha", "the", "thi", "hoga", "hogi",
    "kar", "karna", "karo", "kiya", "ki", "ka", "ke",
    "se", "ko", "ne", "pe", "mein", "tak",
    "bahut", "bohot", "zyada", "kam", "thoda", "sab",
    "abhi", "ab", "phir", "fir", "jab", "tab",
    "agar", "nahi", "naa", "na", "haan", "ji",
    "dekho", "dekh", "suno", "bolo", "chalo", "jao",
    "ek", "do", "teen", "char", "paanch",
    "accha", "bura", "sahi", "galat",
    "log", "logo", "logon", "banda", "bande",
    "sala", "yaar", "bro", "dude", "lol", "omg", "wtf",
    "just", "really", "very", "much", "also", "even",
    "the", "a", "an", "is", "are", "was", "were",
    "has", "have", "had", "will", "would", "could",
    "should", "may", "might", "can", "this", "that",
    "these", "those", "here", "there", "what", "when",
    "where", "who", "why", "how", "which",
    "not", "but", "and", "or", "if", "then",
    "with", "for", "about", "into", "over",
    # Common nouns that models sometimes tag wrongly
    "sir", "madam", "uncle", "aunty", "bhai", "didi",
    "breaking", "update", "news", "watch", "live",
    "video", "photo", "pic", "image",
    "today", "yesterday", "tomorrow", "morning", "evening",
    "india", "indian",  # too generic on their own

    # Hindi adjectives / common words models wrongly tag as entities
    "भारतीय",   # "Indian" — adjective, not a location
    "हिंदू",     # "Hindu" — religion, not entity
    "मुस्लिम",   # "Muslim" — religion
    "ईसाई",     # "Christian" — religion
    "सिख",      # "Sikh" — religion
    "राष्ट्रीय",  # "National" — adjective
    "केंद्रीय",   # "Central" — adjective
    "सरकारी",   # "Government" — adjective
    "नया", "नई", "नए",  # "new" — adjective
    "पुराना", "पुरानी",  # "old" — adjective
    "बड़ा", "बड़ी", "छोटा", "छोटी",  # big/small
}

# Multi-word phrases that should NEVER be entities
# These are common Hindi phrases the model sometimes misclassifies
NON_ENTITY_PHRASES = {
    "हिंदू पर्व",   # "Hindu festival"
    "हिन्दू पर्व",
    "मुस्लिम त्योहार",
    "ईसाई त्योहार",
    "हिंदू त्योहार",
    "हिन्दू त्योहार",
    "राष्ट्रीय पर्व",
    "शुभ दिन",
    "बड़ा दिन",
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 4: MULTI-WORD ENTITY PHRASE SCANNER
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Regex patterns for multi-word entities the model often misses or splits
PHRASE_PATTERNS: List[Tuple[str, str]] = [
    # "X Mandir/Temple/Masjid..." → LOC
    (r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Mandir|Temple|Masjid|Mosque|Gurudwara|Gurdwara|Church|Dargah|Fort|Qila|Palace|Mahal|Dam|Bridge|Chowk|Ghat|Dham|Ashram|Sthal))\b', "LOC"),
    # "X Party/Dal/Sena/Sabha..." → ORG
    (r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Party|Dal|Sena|Parishad|Morcha|Samiti|Sangh|Sabha|Congress|Front|Alliance|Federation|Union|League|Association|Committee|Commission|Board|Council))\b', "ORG"),
    # "X University/Institute/College/Academy..." → ORG
    (r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:University|Institute|College|Academy|School|Hospital|Foundation|Trust|Corporation|Limited|Ltd|Bank|Finance|Industries|Group))\b', "ORG"),
    # "IIT/IIM/NIT/AIIMS X" → ORG
    (r'\b((?:IIT|IIM|NIT|AIIMS|IIIT)\s+[A-Z][a-z]+)\b', "ORG"),
    # "X Pradesh/Hills/Valley/Island" → LOC
    (r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Pradesh|Hills|Valley|Island|Islands|Nagar|Pur|Puram|Abad|Ganj|Garh|Border))\b', "LOC"),
]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 5: CORE REFINEMENT ENGINE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _get_context_window(text: str, entity_text: str, window: int = 5) -> set:
    """Get set of lowercased words within `window` tokens around entity in text."""
    text_lower = text.lower()
    entity_lower = entity_text.lower()
    pos = text_lower.find(entity_lower)
    if pos == -1:
        return set()

    tokens = text_lower.split()
    # Find which token index the entity starts at
    char_count = 0
    start_idx = 0
    for i, tok in enumerate(tokens):
        if char_count >= pos:
            start_idx = i
            break
        char_count += len(tok) + 1  # +1 for space

    left = max(0, start_idx - window)
    right = min(len(tokens), start_idx + window + 1)
    return set(tokens[left:right])


def _match_suffix(text: str, suffix_list: list) -> bool:
    """Check if text ends with any suffix (case-insensitive).
    The suffix must be a whole word — i.e. preceded by a space or be the entire text.
    """
    text_lower = text.lower().strip()
    for suffix in suffix_list:
        suffix_lower = suffix.lower()
        if text_lower.endswith(suffix_lower):
            prefix_len = len(text_lower) - len(suffix_lower)
            # Suffix IS the whole string
            if prefix_len == 0:
                return True
            # Character just before the suffix must be a space (whole-word check)
            if text_lower[prefix_len - 1] == " ":
                return True
    return False


def _match_gazetteer(text: str, gazetteer: set) -> bool:
    """Check if text matches a gazetteer entry (case-insensitive)."""
    return text.lower().strip() in gazetteer


def _reclassify_entity(entity: Dict, text: str) -> Dict:
    """
    Reclassify a single entity using gazetteers, suffix rules, and context.
    Returns the entity with potentially updated label and added metadata.
    """
    ent_text = entity["text"].strip()
    ent_lower = ent_text.lower().strip()
    original_label = entity.get("label", "O")

    # ── STEP 1: Exact gazetteer match (highest priority) ──
    if _match_gazetteer(ent_text, RELIGIOUS_AND_MONUMENT_LOC):
        if original_label != "LOC":
            entity["label"] = "LOC"
            entity["refinement"] = "gazetteer_religious_loc"
        return entity

    if _match_gazetteer(ent_text, INDIAN_LOCATIONS):
        if original_label != "LOC":
            entity["label"] = "LOC"
            entity["refinement"] = "gazetteer_location"
        return entity

    if _match_gazetteer(ent_text, INDIAN_ORGS):
        if original_label != "ORG":
            entity["label"] = "ORG"
            entity["refinement"] = "gazetteer_org"
        return entity

    if _match_gazetteer(ent_text, INDIAN_PERSONS):
        if original_label != "PER":
            entity["label"] = "PER"
            entity["refinement"] = "gazetteer_person"
        return entity

    # ── STEP 2: Suffix-based reclassification ──
    if _match_suffix(ent_text, LOC_SUFFIXES):
        if original_label != "LOC":
            entity["label"] = "LOC"
            entity["refinement"] = "suffix_loc"
        return entity

    if _match_suffix(ent_text, ORG_SUFFIXES):
        if original_label != "ORG":
            entity["label"] = "ORG"
            entity["refinement"] = "suffix_org"
        return entity

    if _match_suffix(ent_text, PER_SUFFIXES):
        if original_label != "PER":
            entity["label"] = "PER"
            entity["refinement"] = "suffix_per"
        return entity

    # ── STEP 3: Context-window voting (only if label is uncertain) ──
    context_words = _get_context_window(text, ent_text)
    per_score = len(context_words & PERSON_CONTEXT)
    loc_score = len(context_words & LOCATION_CONTEXT)
    org_score = len(context_words & ORG_CONTEXT)

    max_score = max(per_score, loc_score, org_score)
    if max_score >= 2:  # Need at least 2 context clues to override
        if per_score == max_score and original_label != "PER":
            entity["label"] = "PER"
            entity["refinement"] = "context_person"
        elif loc_score == max_score and original_label != "LOC":
            entity["label"] = "LOC"
            entity["refinement"] = "context_location"
        elif org_score == max_score and original_label != "ORG":
            entity["label"] = "ORG"
            entity["refinement"] = "context_org"

    return entity


def _discover_entities(text: str, existing_texts: set) -> List[Dict]:
    """
    Find entities the model missed entirely using phrase patterns and gazetteers.
    """
    discovered = []
    discovered_texts = set()

    # ── Phrase pattern matching ──
    for pattern, label in PHRASE_PATTERNS:
        for m in re.finditer(pattern, text):
            matched = m.group(1)
            if matched.lower() not in existing_texts and matched.lower() not in discovered_texts:
                discovered.append({
                    "text": matched,
                    "label": label,
                    "source": "refinement_pattern",
                    "confidence": 0.85,
                })
                discovered_texts.add(matched.lower())

    # ── Scan for known gazetteer entries in text ──
    text_lower = text.lower()

    all_gazetteers = [
        (RELIGIOUS_AND_MONUMENT_LOC, "LOC", "refinement_gazetteer"),
        (INDIAN_ORGS, "ORG", "refinement_gazetteer"),
        (INDIAN_PERSONS, "PER", "refinement_gazetteer"),
        # INDIAN_LOCATIONS intentionally skipped here to avoid
        # false positives on very common single-word city names;
        # the model handles those well enough.
    ]

    for gazetteer, label, source in all_gazetteers:
        for entry in gazetteer:
            if len(entry) < 4:
                continue  # skip very short entries to avoid false positives
            if entry in text_lower:
                # Verify it's not already captured
                if entry not in existing_texts and entry not in discovered_texts:
                    # Find original-case text
                    pos = text_lower.find(entry)
                    original = text[pos: pos + len(entry)]
                    discovered.append({
                        "text": original,
                        "label": label,
                        "source": source,
                        "confidence": 0.90,
                    })
                    discovered_texts.add(entry)

    return discovered


def _filter_junk(entity: Dict) -> bool:
    """Return False for entities that should be removed."""
    text = entity["text"].strip()

    # Too short
    if len(text) < 2:
        return False

    # Pure numbers / punctuation
    if re.fullmatch(r'[\d\s\W]+', text):
        return False

    # Stop words (single word entities only)
    if " " not in text and text.lower() in STOP_WORDS:
        return False

    # Non-entity phrases (multi-word junk)
    if text.lower() in NON_ENTITY_PHRASES:
        return False

    return True


def _merge_entities(entities: List[Dict]) -> List[Dict]:
    """
    Deduplicate entities: if same text appears multiple times,
    keep the one with the highest confidence or the refined label.
    """
    seen: Dict[str, Dict] = {}
    for ent in entities:
        key = ent["text"].lower().strip()
        if key not in seen:
            seen[key] = ent
        else:
            existing = seen[key]
            # Prefer refined labels over model labels
            if ent.get("refinement") and not existing.get("refinement"):
                seen[key] = ent
            # Prefer higher confidence
            elif ent.get("confidence", 0) > existing.get("confidence", 0):
                seen[key] = ent

    return list(seen.values())


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 6: PUBLIC API
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def refine_entities(text: str, model_entities: List[Dict]) -> List[Dict]:
    """
    Main entry point. Takes raw model output and returns refined entities.

    Pipeline:
      1. Filter junk from model output
      2. Reclassify each entity (gazetteers → suffixes → context)
      3. Discover missed entities
      4. Merge duplicates
      5. Convert any leftover GPE → LOC
    """
    # 1. Filter
    entities = [e for e in model_entities if _filter_junk(e)]

    # 2. Reclassify
    entities = [_reclassify_entity(e, text) for e in entities]

    # 3. Discover missed entities
    existing_texts = {e["text"].lower().strip() for e in entities}
    discovered = _discover_entities(text, existing_texts)
    entities.extend(discovered)

    # 4. Merge duplicates
    entities = _merge_entities(entities)

    # 5. Kill any remaining GPE → LOC (safety net)
    for ent in entities:
        if ent.get("label") == "GPE":
            ent["label"] = "LOC"

    # 6. Final filter pass
    entities = [e for e in entities if _filter_junk(e)]

    return entities
