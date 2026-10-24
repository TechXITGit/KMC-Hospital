// Data modeled for KMC Hospital, Jankipuram, Lucknow
// Website: https://kmchospitallucknow.in/

export const HOSPITAL_INFO = {
  name: "KMC Hospital",
  name_hi: "केएमसी अस्पताल",
  fullName: "Hospital",
  address:
    "B-1/6 Sector G, Near Bhawna Shopping Complex, Sahara State Road, Jankipuram, Lucknow, Uttar Pradesh 226021",
  address_hi:
    "बी-1/6 सेक्टर जी, भावना शॉपिंग कॉम्प्लेक्स के पास, सहारा स्टेट रोड, जानकीपुरम, लखनऊ, उत्तर प्रदेश 226021",
  emergencyPrimary: "+918303666400",
  emergencySecondary: "+915224289272",
  ambulanceNumber: "+918303666400",
  whatsapp: "+918303666400",
  instagram: "https://www.instagram.com/kmc___hospital/",
  facebook: "https://www.facebook.com/profile.php?id=61590667442589",
  website: "https://kmchospitallucknow.in/",
  opdTimings: "09:00 AM - 08:00 PM (Mon - Sun)",
  opdTimings_hi: "सुबह 09:00 - रात 08:00 (सोमवार - रविवार)",
  emergencyTimings: "24 Hours Open · 365 Days",
  emergencyTimings_hi: "24 घंटे खुला · 365 दिन",
  locationCoords: { latitude: 26.9238, longitude: 80.9463 },
};

export const QUICK_SERVICES = [
  {
    id: "qs1",
    title: "Maternity Care",
    title_hi: "मातृत्व देखभाल (मैटरनिटी)",
    icon: "female",
    shortDesc: "Comprehensive prenatal, painless delivery & postnatal care.",
    shortDesc_hi: "व्यापक प्रसव पूर्व, दर्द-रहित प्रसव एवं प्रसवोत्तर देखभाल।",
    fullDesc:
      "KMC Maternity Care provides dedicated obstetrics care, advanced fetal monitoring, private labour rooms, painless normal delivery options, and immediate post-birth pediatric neonatal care.",
    fullDesc_hi:
      "केएमसी मातृत्व देखभाल विभाग में 24 घंटे स्त्री एवं प्रसूति रोग विशेषज्ञ, अत्याधुनिक भ्रूण मॉनिटरिंग, निजी लेबर रूम, दर्द-रहित सामान्य प्रसव और जन्म के तुरंत बाद नवजात शिशु गहन देखभाल की सुविधा उपलब्ध है।",
    highlights: [
      "24x7 High-Risk Pregnancy Management",
      "Painless Delivery / Epidural Analgesia",
      "State-of-the-Art Labour Delivery Recovery (LDR) Rooms",
      "Continuous Cardiotocography (CTG) Fetal Monitoring",
      "Experienced Senior Gynecologists & Neonatologists",
    ],
    highlights_hi: [
      "24x7 उच्च जोखिम गर्भावस्था प्रबंधन",
      "दर्द-रहित प्रसव (एपिड्यूरल एनाल्जेसिया)",
      "आधुनिक लेबर डिलीवरी रिकवरी (LDR) कक्ष",
      "निरंतर सीटीजी भ्रूण हृदय गति निगरानी",
      "वरिष्ठ एवं अनुभवी स्त्री रोग विशेषज्ञ",
    ],
    timings: "24x7 Emergency Delivery & Care",
    timings_hi: "24x7 आपातकालीन प्रसव एवं देखभाल",
  },
  {
    id: "qs2",
    title: "NICU & PICU",
    title_hi: "एनआईसीयू एवं पीआईसीयू (NICU/PICU)",
    icon: "medkit",
    shortDesc: "Advanced neonatal & pediatric intensive care with ventilators.",
    shortDesc_hi: "वेंटिलेटर और मॉनिटर से सुसज्जित आधुनिक नवजात एवं बाल गहन चिकित्सा।",
    fullDesc:
      "Our Level-III Neonatal Intensive Care Unit (NICU) and Pediatric ICU are equipped with invasive & non-invasive ventilators, multi-channel monitors, phototherapy units, and 24x7 neonatologist coverage.",
    fullDesc_hi:
      "हमारा लेवल-III एनआईसीयू एवं पीआईसीयू समय से पूर्व जन्मे बच्चों, कम वजन वाले शिशुओं और गंभीर रूप से बीमार बच्चों के लिए उन्नत वेंटिलेटर, फोटोथेरेपी यूनिट और 24x7 बाल रोग विशेषज्ञ डॉक्टरों की टीम से सुसज्जित है।",
    highlights: [
      "Advanced High-Frequency & Conventional Ventilators",
      "Total Parenteral Nutrition (TPN) Protocol",
      "In-House Blood Gas (ABG) & Micro-Lab",
      "Trained Pediatric ICU Nurses (1:1 Nurse-to-Patient Ratio)",
      "Dedicated Neonatal Transport Ambulance",
    ],
    highlights_hi: [
      "हाई-फ्रीक्वेंसी एवं आधुनिक बाल वेंटिलेटर",
      "टीपीएन (पूर्ण पोषण) प्रोटोकॉल",
      "अस्पताल के अंदर तत्काल एबीजी एवं माइक्रो लैब जांच",
      "प्रशिक्षित आईसीयू नर्सिंग स्टाफ",
      "इनक्यूबेटर युक्त विशेष नवजात एम्बुलेंस",
    ],
    timings: "24x7 Round-the-Clock Critical Care",
    timings_hi: "24x7 निरंतर आपातकालीन गहन चिकित्सा",
  },
  {
    id: "qs3",
    title: "Pediatric Surgery",
    title_hi: "बाल शल्य चिकित्सा (पीडियाट्रिक सर्जरी)",
    icon: "cut",
    shortDesc: "Minimally invasive and congenital surgeries for children.",
    shortDesc_hi: "बच्चों और नवजात शिशुओं की लेप्रोस्कोपिक एवं जन्मजात विकारों की सर्जरी।",
    fullDesc:
      "Led by expert pediatric surgeons for congenital anomalies, pediatric laparoscopy, neonatal emergency surgeries, and day-care minor procedures with specialized pediatric anesthesia.",
    fullDesc_hi:
      "विशेषज्ञ बाल शल्य चिकित्सकों के नेतृत्व में नवजात शिशुओं की आपातकालीन सर्जरी, बच्चों की दूरबीन (लेप्रोस्कोपिक) सर्जरी और बाल एनेस्थीसिया के साथ डे-केयर प्रक्रियाएं की जाती हैं।",
    highlights: [
      "Neonatal & Infant Emergency Surgeries",
      "Pediatric Laparoscopic Procedures",
      "Hernia, Hydrocele, Appendectomy",
      "Post-operative Pediatric Surgical ICU Care",
    ],
    highlights_hi: [
      "नवजात शिशु आपातकालीन सर्जरी",
      "बच्चों की दूरबीन (लेप्रोस्कोपिक) सर्जरी",
      "हर्निया, हाइड्रोसील, अपेंडिक्स ऑपरेशन",
      "ऑपरेशन के बाद विशेष सर्जिकल आईसीयू देखभाल",
    ],
    timings: "Daily OPD & 24x7 Surgical Emergencies",
    timings_hi: "दैनिक ओपीडी एवं 24x7 सर्जिकल इमरजेंसी",
  },
  {
    id: "qs4",
    title: "General Surgery",
    title_hi: "सामान्य एवं दूरबीन सर्जरी",
    icon: "medical",
    shortDesc: "Laparoscopic and advanced elective & emergency surgeries.",
    shortDesc_hi: "लेप्रोस्कोपिक पित्त की थैली, हर्निया, अपेंडिक्स एवं आपातकालीन ऑपरेशन।",
    fullDesc:
      "State-of-the-art modular operation theatres equipped with HD laparoscopy towers, cautery systems, and sterile recovery bays for swift patient discharge.",
    fullDesc_hi:
      "संक्रमण-मुक्त मॉड्यूलर ऑपरेशन थिएटर, हाई-डेफिनिशन लेप्रोस्कोपी टॉवर और आधुनिक उपकरणों द्वारा सुरक्षित एवं त्वरित रिकवरी वाली सर्जरी की सुविधा उपलब्ध है।",
    highlights: [
      "Advanced Laparoscopic Cholecystectomy & Hernia Repair",
      "Trauma & Acute Abdomen Emergencies",
      "Modern Modular Infection-Controlled Operation Theatres",
      "Same-Day Day-Care Surgeries Available",
    ],
    highlights_hi: [
      "उन्नत लेप्रोस्कोपिक पित्ताशय एवं हर्निया ऑपरेशन",
      "पेट की गंभीर समस्याएं एवं ट्रॉमा सर्जरी",
      "आधुनिक संक्रमण-मुक्त मॉड्यूलर ऑपरेशन थिएटर",
      "डे-केयर सर्जरी की सुविधा",
    ],
    timings: "OPD: 10:00 AM - 07:00 PM | Emergency: 24x7",
    timings_hi: "ओपीडी: सुबह 10:00 - शाम 07:00 | इमरजेंसी: 24x7",
  },
  {
    id: "qs5",
    title: "24x7 Pharmacy",
    title_hi: "24x7 फार्मेसी (दवाखाना)",
    icon: "medkit-outline",
    shortDesc: "Round-the-clock hospital dispensary with all pediatric & maternity medicines.",
    shortDesc_hi: "सभी बाल रोग, मातृत्व एवं आपातकालीन दवाएं 24 घंटे उपलब्ध।",
    fullDesc:
      "In-house 24-hour pharmacy ensuring 100% genuine vaccines, pediatric dosage syrups, surgical supplies, and maternal medications with computerized billing.",
    fullDesc_hi:
      "अस्पताल परिसर में 24 घंटे संचालित फार्मेसी, जहाँ 100% प्रामाणिक टीके, बच्चों की सिरप, सर्जिकल सामग्री और मातृ स्वास्थ्य की दवाएं उपलब्ध रहती हैं।",
    highlights: [
      "Cold-Chain Maintained Pediatric Vaccines",
      "Emergency Injectables & Critical Care Formulations",
      "Home Delivery within Jankipuram & Nearby Areas",
      "Digital Prescription Tracking",
    ],
    highlights_hi: [
      "कोल्ड-चेन में सुरक्षित बच्चों के टीके",
      "आपातकालीन इंजेक्शन एवं जीवन रक्षक दवाएं",
      "जानकीपुरम एवं नजदीकी क्षेत्रों में डिलीवरी",
      "डिजिटल प्रिस्क्रिप्शन ट्रैकिंग",
    ],
    timings: "Open 24 Hours, 365 Days",
    timings_hi: "24 घंटे खुला, 365 दिन",
  },
  {
    id: "qs6",
    title: "Home Care",
    title_hi: "होम केयर सेवा",
    icon: "home",
    shortDesc: "Doctor home visits, nursing care, and sample collection at doorstep.",
    shortDesc_hi: "घर पर ब्लड सैंपल कलेक्शन, नर्सिंग देखभाल और डॉक्टर परामर्श।",
    fullDesc:
      "Professional healthcare services right at your home including blood sample collection, postnatal mother & baby nursing care, dressing, and doctor consultations.",
    fullDesc_hi:
      "आपके घर पर ही पेशेवर स्वास्थ्य सेवाएं, जैसे ब्लड व यूरिन जांच के सैंपल लेना, नवजात शिशु व माँ की नर्सिंग देखभाल, ड्रेसिंग और डॉक्टर विजिट।",
    highlights: [
      "Doorstep Blood & Diagnostic Sample Collection",
      "Postnatal Nurse Support for New Mothers",
      "Elderly Care & Wound Dressing",
      "Vaccination at Home on Request",
    ],
    highlights_hi: [
      "घर बैठे ब्लड एवं डायग्नोस्टिक सैंपल कलेक्शन",
      "नई माताओं के लिए प्रसवोत्तर नर्सिंग सहायता",
      "घाव की ड्रेसिंग एवं बुजुर्गों की देखभाल",
      "अनुरोध पर घर पर टीकाकरण सुविधा",
    ],
    timings: "08:00 AM - 08:00 PM Daily",
    timings_hi: "सुबह 08:00 - रात 08:00 प्रतिदिन",
  },
  {
    id: "qs7",
    title: "Video Consult",
    title_hi: "वीडियो परामर्श (टेलीकंसल्ट)",
    icon: "videocam",
    shortDesc: "Consult top specialists from home via secure HD video call.",
    shortDesc_hi: "घर बैठे सुरक्षित वीडियो कॉल द्वारा विशेषज्ञ डॉक्टरों से परामर्श लें।",
    fullDesc:
      "Connect directly with KMC Hospital's doctors via secure video call. Discuss health concerns, get digital prescriptions, and follow up without traveling.",
    fullDesc_hi:
      "केएमसी अस्पताल के अनुभवी डॉक्टरों से घर बैठे सुरक्षित वीडियो कॉल से जुड़ें। बिना अस्पताल आए परामर्श लें और तुरंत डिजिटल पर्ची प्राप्त करें।",
    highlights: [
      "Instant or Scheduled Consultations",
      "Digitally Signed Prescription on App",
      "Follow-Up Review Support",
      "Private & End-to-End Encrypted",
    ],
    highlights_hi: [
      "तुरंत या अपनी सुविधा अनुसार समय स्लॉट बुकिंग",
      "ऐप पर डिजिटल हस्ताक्षरित डॉक्टर की पर्ची",
      "फॉलो-अप परामर्श की आसान सुविधा",
      "पूर्णतः निजी एवं सुरक्षित एंड-टू-एंड एन्क्रिप्टेड",
    ],
    timings: "09:00 AM - 09:00 PM Daily",
    timings_hi: "सुबह 09:00 - रात 09:00 प्रतिदिन",
  },
  {
    id: "qs8",
    title: "Lab & Diagnostics",
    title_hi: "पैथोलॉजी व डायग्नोस्टिक्स",
    icon: "flask",
    shortDesc: "High-precision automated pathology, ultrasound, and digital X-Ray.",
    shortDesc_hi: "सटीक ऑटोमेटेड पैथोलॉजी जांच, 4D अल्ट्रासाउंड एवं डिजिटल एक्स-रे।",
    fullDesc:
      "Equipped with automated biochemistry analyzers, hematology counters, 4D ultrasound, and digital imaging for rapid, verified diagnostic reporting.",
    fullDesc_hi:
      "पूरी तरह ऑटोमेटेड बायोकेमिस्ट्री एवं हेमेटोलॉजी एनालाइजर, 4D अल्ट्रासाउंड और डिजिटल एक्स-रे से सटीक और शीघ्र जांच रिपोर्ट प्रदान की जाती है।",
    highlights: [
      "Automated Blood & Urine Analysis",
      "Obstetric & Pediatric 4D Ultrasound (USG)",
      "Digital X-Ray & ECG",
      "Same-Day Online Report Delivery in App",
    ],
    highlights_hi: [
      "ऑटोमेटेड ब्लड एवं यूरिन टेस्ट",
      "गर्भावस्था एवं बाल 4D अल्ट्रासाउंड (USG)",
      "डिजिटल एक्स-रे एवं ईसीजी (ECG)",
      "उसी दिन ऐप पर डिजिटल रिपोर्ट उपलब्ध",
    ],
    timings: "24x7 Emergency Diagnostics",
    timings_hi: "24x7 आपातकालीन जांच सुविधा",
  },
];

export const DEPARTMENTS = [
  {
    id: "d1",
    name: "Obstetrics & Gynaecology",
    name_hi: "प्रसूति एवं स्त्री रोग विभाग",
    icon: "female",
    doctorCount: 2,
    overview:
      "Premier department providing comprehensive women's healthcare, antenatal counseling, painless delivery, laparoscopic hysterectomy, and fertility care.",
    overview_hi:
      "महिलाओं के सम्पूर्ण स्वास्थ्य, प्रसव पूर्व परामर्श, दर्द-रहित प्रसव, दूरबीन विधि से बच्चेदानी के ऑपरेशन और बांझपन के इलाज हेतु समर्पित विभाग।",
    facilities: [
      "24x7 Emergency Delivery Units",
      "Advanced 4D Fetal Ultrasound",
      "Painless Delivery (Epidural Analgesia)",
      "High-Risk Pregnancy Intensive Unit",
      "Gynecological Laparoscopy",
    ],
    facilities_hi: [
      "24x7 आपातकालीन प्रसव कक्ष",
      "उन्नत 4D भ्रूण अल्ट्रासाउंड",
      "दर्द-रहित प्रसव (एपिड्यूरल एनाल्जेसिया)",
      "उच्च जोखिम गर्भावस्था निगरानी इकाई",
      "स्त्री रोग दूरबीन (लेप्रोस्कोपी) सर्जरी",
    ],
  },
  {
    id: "d2",
    name: "Neonatology (NICU)",
    name_hi: "नवजात शिशु गहन चिकित्सा (NICU)",
    icon: "body",
    doctorCount: 1,
    overview:
      "Specialized care for premature infants, low birth weight babies, and critically ill newborns with tertiary-level Level III NICU support.",
    overview_hi:
      "समय पूर्व जन्मे, कम वजन वाले और गंभीर नवजात शिशुओं की 24 घंटे जीवन रक्षक देखभाल हेतु लेवल-III एनआईसीयू सहायता।",
    facilities: [
      "Level-III Neonatal Intensive Care Unit",
      "High-Frequency Oscillatory Ventilators",
      "Advanced LED Phototherapy Units",
      "Neonatal Transport Ambulance with Incubator",
      "In-House Blood Gas (ABG) Monitoring",
    ],
    facilities_hi: [
      "लेवल-III नवजात गहन चिकित्सा इकाई",
      "उन्नत हाई-फ्रीक्वेंसी वेंटिलेटर",
      "एलईडी फोटोथेरेपी यूनिट (पीलिया उपचार)",
      "इनक्यूबेटर युक्त नवजात एम्बुलेंस",
      "तत्काल ब्लड गैस (ABG) जांच",
    ],
  },
  {
    id: "d3",
    name: "Pediatrics & PICU",
    name_hi: "बाल रोग एवं पीआईसीयू (PICU)",
    icon: "happy",
    doctorCount: 1,
    overview:
      "Holistic child healthcare from birth up to adolescence, handling developmental assessments, vaccinations, pediatric infectious diseases, and pediatric critical care.",
    overview_hi:
      "शिशु के जन्म से लेकर किशोरावस्था तक समग्र स्वास्थ्य देखभाल, संपूर्ण टीकाकरण, संक्रामक रोगों का उपचार एवं बाल गहन चिकित्सा।",
    facilities: [
      "Pediatric Intensive Care Unit (PICU)",
      "Dedicated Pediatric Immunization Clinic",
      "Growth & Developmental Screening",
      "Child Asthma & Allergy Clinic",
      "Pediatric Emergency Care",
    ],
    facilities_hi: [
      "बाल गहन चिकित्सा इकाई (PICU)",
      "समर्पित बाल टीकाकरण क्लिनिक",
      "शारीरिक एवं मानसिक विकास जांच",
      "बच्चों के दमा एवं एलर्जी का क्लिनिक",
      "24 घंटे बाल आपातकालीन चिकित्सा",
    ],
  },
  {
    id: "d4",
    name: "Pediatric Surgery",
    name_hi: "बाल शल्य चिकित्सा विभाग",
    icon: "cut",
    doctorCount: 1,
    overview:
      "Dedicated surgical department for neonatal surgical emergencies, congenital malformations, pediatric urology, and laparoscopic procedures.",
    overview_hi:
      "नवजात शिशुओं की जन्मजात विकृतियों, बाल मूत्र रोग (यूरोलॉजी) और दूरबीन पद्धति से बच्चों की सर्जरी हेतु समर्पित विभाग।",
    facilities: [
      "Modular Pediatric Operation Theatres",
      "Child-Specific Anesthesia Equipment",
      "Post-Op Pediatric Surgical Monitoring",
      "Day Care Surgery Facilities",
    ],
    facilities_hi: [
      "बच्चों के लिए मॉड्यूलर ऑपरेशन थिएटर",
      "बाल विशिष्ट एनेस्थीसिया उपकरण",
      "सर्जरी उपरांत विशेष निगरानी वार्ड",
      "डे-केयर सर्जरी की सुविधा",
    ],
  },
  {
    id: "d5",
    name: "General Surgery",
    name_hi: "सामान्य एवं लेप्रोस्कोपिक सर्जरी",
    icon: "medical",
    doctorCount: 1,
    overview:
      "Modern surgical care specializing in minimal-access laparoscopic abdominal surgeries, trauma management, hernia repair, and wound care.",
    overview_hi:
      "दूरबीन विधि द्वारा पेट की सर्जरी, हर्निया, अपेंडिक्स, गॉलब्लैडर पथरी, चोट एवं आंतों की बीमारियों का आधुनिक उपचार।",
    facilities: [
      "HD Laparoscopic Towers",
      "Modular Infection-Proof Operation Theatres",
      "Emergency Trauma Bays",
      "Surgical Step-Down Unit",
    ],
    facilities_hi: [
      "हाई-डेफिनिशन लेप्रोस्कोपिक टावर",
      "संक्रमण-मुक्त मॉड्यूलर ओटी",
      "आपातकालीन ट्रॉमा केयर यूनिट",
      "सर्जिकल रिकवरी वार्ड",
    ],
  },
  {
    id: "d6",
    name: "Orthopaedics",
    name_hi: "हड्डी एवं जोड़ रोग (ऑर्थोपेडिक्स)",
    icon: "bandage",
    doctorCount: 1,
    overview:
      "Comprehensive bone and joint care, fracture treatment, pediatric deformity corrections, arthritis management, and rehabilitation.",
    overview_hi:
      "हड्डियों के फ्रैक्चर, जोड़ों के दर्द, बच्चों की हड्डियों की विकृति के सुधार, गठिया और फिजियोथेरेपी पुनर्वास का संपूर्ण समाधान।",
    facilities: [
      "Digital C-Arm Fluoroscopy Unit",
      "Fracture & Trauma Care Clinic",
      "Pediatric Orthopedic Rehabilitation",
      "Physiotherapy & Recovery Unit",
    ],
    facilities_hi: [
      "डिजिटल सी-आर्म फ्लोरोस्कोपी यूनिट",
      "फ्रैक्चर एवं एक्सीडेंट ट्रॉमा क्लिनिक",
      "बच्चों की हड्डी रोग पुनर्वास",
      "फिजियोथेरेपी एवं रिकवरी केंद्र",
    ],
  },
  {
    id: "d7",
    name: "Emergency & Trauma",
    name_hi: "आपातकालीन एवं ट्रॉमा सेवा",
    icon: "alert-circle",
    doctorCount: 4,
    overview:
      "Round-the-clock emergency casualty staffed by emergency physicians, trauma nurses, and direct integration with operation theatres and ICUs.",
    overview_hi:
      "24 घंटे खुली आपातकालीन कैजुअल्टी, जिसमें अनुभवी आपातकालीन डॉक्टर, नर्सिंग स्टाफ और सीधे ऑपरेशन थिएटर व आईसीयू से जुड़ाव है।",
    facilities: [
      "24x7 Dedicated Trauma Bay",
      "Cardiac Monitors & Defibrillators",
      "Emergency Ultrasound & X-Ray",
      "Immediate Blood Transfusion Protocols",
    ],
    facilities_hi: [
      "24x7 समर्पित ट्रॉमा एवं एक्सीडेंट यूनिट",
      "कार्डियक मॉनिटर एवं डिफिब्रिलेटर",
      "तत्काल आपातकालीन अल्ट्रासाउंड व एक्स-रे",
      "आपातकालीन ब्लड ट्रांसफ्यूजन प्रोटोकॉल",
    ],
  },
  {
    id: "d8",
    name: "Pharmacy & Diagnostics",
    name_hi: "फार्मेसी एवं जांच केंद्र",
    icon: "flask",
    doctorCount: 2,
    overview:
      "24-hour in-house computerized pharmacy and fully automated pathology laboratory delivering fast, accurate reports.",
    overview_hi:
      "24 घंटे खुला दवाखाना और पूरी तरह ऑटोमेटेड पैथोलॉजी लैब, जो त्वरित और विश्वसनीय जांच रिपोर्ट उपलब्ध कराती है।",
    facilities: [
      "Fully Automated Hematology & Biochemistry",
      "100% Genuine Certified Medicines",
      "Cold-Storage Vaccine Compliance",
      "Online Report Sync with Mobile App",
    ],
    facilities_hi: [
      "ऑटोमेटेड हेमेटोलॉजी एवं बायोकेमिस्ट्री",
      "100% प्रामाणिक प्रमाणित दवाएं",
      "कोल्ड स्टोरेज वैक्सीन सुरक्षा",
      "मोबाइल ऐप पर सीधे रिपोर्ट सिंक",
    ],
  },
];

export const DOCTORS = [
  {
    id: "doc1",
    name: "Dr. Puneet Kumar Tulsyan",
    name_hi: "डॉ. पुनीत कुमार तुलस्यान",
    specialty: "Neonatologist & Pediatrician",
    specialty_hi: "नवजात शिशु एवं बाल रोग विशेषज्ञ",
    qualification: "MBBS, DNB (Pediatrics), PGPN - Boston University, MIAP, MNNF",
    experience: "15+ Yrs",
    experience_hi: "15+ वर्ष अनुभव",
    department: "Neonatology (NICU)",
    department_hi: "नवजात शिशु गहन चिकित्सा (NICU)",
    fee: "₹1,000",
    availableDays: "Mon - Sat (10:00 AM - 02:00 PM, 05:00 PM - 08:00 PM)",
    availableDays_hi: "सोम - शनि (सुबह 10:00 - दोपहर 02:00, शाम 05:00 - रात 08:00)",
    about:
      "Dr. Puneet Kumar Tulsyan is a renowned neonatologist and pediatrician with over 15 years of experience in managing high-risk newborns, premature infants, and pediatric critical care.",
    about_hi:
      "डॉ. पुनीत कुमार तुलस्यान लखनऊ के प्रतिष्ठित नवजात शिशु एवं बाल रोग विशेषज्ञ हैं, जिन्हें उच्च जोखिम वाले नवजात शिशुओं, समय पूर्व जन्मे बच्चों और बाल गहन चिकित्सा में 15 से अधिक वर्षों का अनुभव प्राप्त है।",
  },
  {
    id: "doc2",
    name: "Dr. Neeta Khare",
    name_hi: "डॉ. नीता खरे",
    specialty: "Senior Consultant, OBS & GYNAE",
    specialty_hi: "वरिष्ठ स्त्री एवं प्रसूति रोग विशेषज्ञ",
    qualification: "MBBS, DGO",
    experience: "20+ Yrs",
    experience_hi: "20+ वर्ष अनुभव",
    department: "Obstetrics & Gynaecology",
    department_hi: "प्रसूति एवं स्त्री रोग विभाग",
    fee: "₹800",
    availableDays: "Mon - Sat (10:30 AM - 02:30 PM)",
    availableDays_hi: "सोम - शनि (सुबह 10:30 - दोपहर 02:30)",
    about:
      "Dr. Neeta Khare is a trusted senior gynecologist in Lucknow with over two decades of excellence in high-risk pregnancy care, painless normal delivery, and women's health.",
    about_hi:
      "डॉ. नीता खरे लखनऊ की जानी-मानी वरिष्ठ स्त्री रोग विशेषज्ञ हैं, जिन्हें उच्च जोखिम गर्भावस्था, दर्द-रहित सामान्य प्रसव और महिलाओं के स्वास्थ्य प्रबंधन में 20 से अधिक वर्षों का विशिष्ट अनुभव है।",
  },
  {
    id: "doc3",
    name: "Prof. (Dr.) Ratnesh Kumar",
    name_hi: "प्रो. (डॉ.) रत्नेश कुमार",
    specialty: "Orthopaedics Specialist",
    specialty_hi: "हड्डी एवं जोड़ रोग विशेषज्ञ",
    qualification: "MBBS, MS, DNB PMR",
    experience: "18+ Yrs",
    experience_hi: "18+ वर्ष अनुभव",
    department: "Orthopaedics",
    department_hi: "हड्डी एवं जोड़ रोग (ऑर्थोपेडिक्स)",
    fee: "₹800",
    availableDays: "Tue, Thu, Sat (04:00 PM - 07:00 PM)",
    availableDays_hi: "मंगल, गुरु, शनि (शाम 04:00 - शाम 07:00)",
    about:
      "Prof. (Dr.) Ratnesh Kumar brings exceptional expertise in joint disorders, pediatric bone deformities, fracture management, and physical rehabilitation.",
    about_hi:
      "प्रो. (डॉ.) रत्नेश कुमार जोड़ों के दर्द, बच्चों की हड्डियों की विकृति के सुधार, जटिल फ्रैक्चर प्रबंधन और शारीरिक पुनर्वास में उत्कृष्ट विशेषज्ञता रखते हैं।",
  },
  {
    id: "doc4",
    name: "Dr. Ajay Kumar Verma",
    name_hi: "डॉ. अजय कुमार वर्मा",
    specialty: "Pediatric Surgery Specialist",
    specialty_hi: "बाल शल्य चिकित्सा (पीडियाट्रिक सर्जरी) विशेषज्ञ",
    qualification: "MS, MCh (Pediatric Surgery)",
    experience: "12+ Yrs",
    experience_hi: "12+ वर्ष अनुभव",
    department: "Pediatric Surgery",
    department_hi: "बाल शल्य चिकित्सा विभाग",
    fee: "₹900",
    availableDays: "Mon, Wed, Fri (11:00 AM - 02:00 PM)",
    availableDays_hi: "सोम, बुध, शुक्र (सुबह 11:00 - दोपहर 02:00)",
    about:
      "Dr. Ajay Kumar Verma specializes in neonatal surgical interventions, pediatric minimally invasive laparoscopy, and pediatric urology.",
    about_hi:
      "डॉ. अजय कुमार वर्मा नवजात शिशुओं की सर्जरी, बच्चों की दूरबीन (लेप्रोस्कोपिक) सर्जरी और बच्चों के मूत्र रोग संबंधी विकारों के विशेषज्ञ हैं।",
  },
  {
    id: "doc5",
    name: "Dr. Athar Parvez",
    name_hi: "डॉ. अतहर परवेज़",
    specialty: "General & Laparoscopic Surgeon",
    specialty_hi: "सामान्य एवं लेप्रोस्कोपिक सर्जन",
    qualification: "MBBS, DNB (Surgery)",
    experience: "10+ Yrs",
    experience_hi: "10+ वर्ष अनुभव",
    department: "General Surgery",
    department_hi: "सामान्य एवं लेप्रोस्कोपिक सर्जरी",
    fee: "₹700",
    availableDays: "Mon - Sat (02:00 PM - 06:00 PM)",
    availableDays_hi: "सोम - शनि (दोपहर 02:00 - शाम 06:00)",
    about:
      "Dr. Athar Parvez provides advanced laparoscopic surgical care, including gall bladder, appendix, hernia, and acute surgical emergencies.",
    about_hi:
      "डॉ. अतहर परवेज़ उन्नत लेप्रोस्कोपिक शल्य चिकित्सा प्रदान करते हैं, जिसमें गॉलब्लैडर, अपेंडिक्स, हर्निया और आपातकालीन पेट के ऑपरेशन शामिल हैं।",
  },
  {
    id: "doc6",
    name: "Dr. Megha Tulsyan",
    name_hi: "डॉ. मेघा तुलस्यान",
    specialty: "OBS & GYNAE - Gold Medalist",
    specialty_hi: "स्त्री एवं प्रसूति रोग विशेषज्ञ - गोल्ड मेडलिस्ट",
    qualification: "MBBS, MS (Obstetrics & Gynaecology)",
    experience: "14+ Yrs",
    experience_hi: "14+ वर्ष अनुभव",
    department: "Obstetrics & Gynaecology",
    department_hi: "प्रसूति एवं स्त्री रोग विभाग",
    fee: "₹800",
    availableDays: "Mon - Sat (04:00 PM - 08:00 PM)",
    availableDays_hi: "सोम - शनि (शाम 04:00 - रात 08:00)",
    about:
      "Dr. Megha Tulsyan is an academic gold medalist and gynecologist renowned for compassionate maternal care, adolescent gynecology, and high-risk pregnancy deliveries.",
    about_hi:
      "डॉ. मेघा तुलस्यान एक गोल्ड मेडलिस्ट स्त्री रोग विशेषज्ञ हैं, जो सुरक्षित मातृत्व, किशोरियों के स्वास्थ्य और उच्च जोखिम वाले प्रसव के लिए प्रसिद्ध हैं।",
  },
];

export const HEALTH_TIPS = [
  {
    id: "ht1",
    title: "Newborn Care Basics: Essential Tips for Parents",
    title_hi: "नवजात शिशु की देखभाल: माता-पिता के लिए आवश्यक सुझाव",
    summary: "Simple daily habits to keep your newborn healthy, clean, and comfortable.",
    summary_hi: "नवजात शिशु को स्वस्थ, स्वच्छ और सुरक्षित रखने के लिए सरल दैनिक आदतें।",
    category: "Newborn Care",
    category_hi: "नवजात शिशु देखभाल",
    readTime: "3 min read",
    readTime_hi: "3 मिनट पढ़ें",
    author: "Dr. Puneet Kumar Tulsyan",
    author_hi: "डॉ. पुनीत कुमार तुलस्यान",
    content: `Welcoming a new baby home is an exciting milestone. Here are essential tips every parent should keep in mind:

1. Hand Hygiene: Always wash your hands or sanitize before holding your newborn. Babies have developing immune systems.
2. Umbilical Cord Care: Keep the cord stump clean and dry until it naturally falls off (usually 1–2 weeks). Avoid applying oils or powders.
3. Feeding on Demand: Newborns should be breastfed every 2 to 3 hours or whenever showing hunger cues like lip-smacking or rooting.
4. Safe Sleep: Always place your baby on their back on a firm, flat mattress without pillows, loose blankets, or soft toys to prevent SIDS.
5. Bathing: Sponge baths are recommended until the umbilical cord stump falls off. Keep bath time under 5-10 minutes in lukewarm water.`,
    content_hi: `घर में नन्हे मेहमान का आगमन एक सुखद अनुभव है। हर माता-पिता को इन आवश्यक बातों का ध्यान रखना चाहिए:

1. हाथों की स्वच्छता: नवजात शिशु को गोद में लेने से पहले हमेशा अपने हाथ साबुन से धोएं या सैनिटाइज़ करें। नवजात शिशुओं की रोग प्रतिरोधक क्षमता विकसित हो रही होती है।
2. गर्भनाल (कॉर्ड) की देखभाल: नाभि के ठूंठ को हमेशा साफ और सूखा रखें जब तक कि वह अपने आप न गिर जाए (आमतौर पर 1-2 सप्ताह)। उस पर तेल या पाउडर न लगाएं।
3. मांग पर स्तनपान: नवजात शिशु को हर 2 से 3 घंटे में या जब भी वह भूख के संकेत दे (जैसे होंठ हिलाना या अंगूठा चूसना), स्तनपान कराएं।
4. सुरक्षित नींद: शिशु को हमेशा एक समतल और सख्त गद्दे पर पीठ के बल सुलाएं। तकिए, ढीले कंबल या मुलायम खिलौने बिस्तर पर न रखें।
5. स्नान के नियम: जब तक नाभि का ठूंठ न गिरे, तब तक स्पंज बाथ (गुनगुने पानी में भीगे कपड़े से सफाई) की सलाह दी जाती है।`,
  },
  {
    id: "ht2",
    title: "Nutrition & Diet Guidelines During Pregnancy",
    title_hi: "गर्भावस्था में खान-पान एवं पोषण संबंधी जरूरी दिशानिर्देश",
    summary: "Key foods and hydration habits every expecting mother should know about.",
    summary_hi: "गर्भवती महिलाओं के लिए आवश्यक पौष्टिक आहार, पानी की मात्रा और जरूरी सावधानियां।",
    category: "Maternity",
    category_hi: "मातृत्व एवं पोषण",
    readTime: "4 min read",
    readTime_hi: "4 मिनट पढ़ें",
    author: "Dr. Neeta Khare",
    author_hi: "डॉ. नीता खरे",
    content: `A balanced, nutrient-rich diet is essential for the healthy growth of both the mother and baby:

1. Folic Acid & Iron: Vital in the first trimester to prevent neural tube defects and maternal anemia. Include spinach, lentils, and citrus fruits.
2. Calcium & Vitamin D: Crucial for developing strong bones and teeth. Consume milk, yogurt, paneer, and fortified cereals.
3. Adequate Hydration: Drink at least 8 to 10 glasses of water daily to maintain amniotic fluid levels and prevent urinary infections.
4. Foods to Avoid: Unpasteurized dairy products, raw/undercooked eggs, excessive caffeine, and raw papaya.
5. Regular Prenatal Screenings: Attend all scheduled ultrasound scans and doctor consultations at KMC Hospital.`,
    content_hi: `गर्भावस्था में माँ और गर्भस्थ शिशु दोनों के स्वस्थ विकास के लिए संतुलित एवं पोषक तत्वों से भरपूर आहार अनिवार्य है:

1. फोलिक एसिड एवं आयरन: पहली तिमाही में बच्चे के मस्तिष्क विकास और माँ में खून की कमी रोकने के लिए पालक, दालें, हरी सब्जियां और खट्टे फल खाएं।
2. कैल्शियम एवं विटामिन D: बच्चे की मजबूत हड्डियों और दांतों के विकास के लिए दूध, दही, पनीर और मखाना अपनी डाइट में शामिल करें।
3. पर्याप्त पानी पिएं: दिन में कम से कम 8 से 10 गिलास पानी पिएं ताकि गर्भजल (एमनियोटिक फ्लूइड) का स्तर सही रहे और यूरिन इन्फेक्शन से बचाव हो।
4. इन चीजों से परहेज करें: कच्चा पपीता, अधपका खाना, अधिक कैफीन (चाय/कॉफी) और कच्चा दूध न पिएं।
5. नियमित जांच: केएमसी अस्पताल में अपने सभी निर्धारित अल्ट्रासाउंड स्कैन और डॉक्टर परामर्श समय पर कराएं।`,
  },
  {
    id: "ht3",
    title: "When to Rush to the Hospital: Infant Warning Signs",
    title_hi: "अस्पताल कब ले जाएं: नवजात शिशुओं में खतरे के लक्षण",
    summary: "Critical warning signs in infants that require immediate medical attention.",
    summary_hi: "नवजात शिशु में दिखने वाले गंभीर लक्षण जिन पर तुरंत डॉक्टर से संपर्क करना आवश्यक है।",
    category: "Emergency Care",
    category_hi: "आपातकालीन शिशु देखभाल",
    readTime: "2 min read",
    readTime_hi: "2 मिनट पढ़ें",
    author: "Dr. Puneet Kumar Tulsyan",
    author_hi: "डॉ. पुनीत कुमार तुलस्यान",
    content: `Recognizing distress signs early can prevent complications. Visit KMC Emergency immediately if your baby exhibits:

• High fever (> 100.4°F in babies under 3 months)
• Fast breathing or chest retractions (skin pulling in between the ribs)
• Excessive lethargy, drowsiness, or difficulty waking up
• Persistent vomiting or inability to keep milk down
• Yellowing of eyes and skin extending down to the abdomen
• Less than 4 wet diapers in 24 hours (sign of dehydration)

KMC Hospital Emergency Helpline: +91 8303666400 (Available 24x7).`,
    content_hi: `लक्षणों को समय रहते पहचानना बच्चे की जान बचा सकता है। यदि आपके शिशु में इनमें से कोई भी लक्षण दिखे, तो तुरंत केएमसी इमरजेंसी में लाएं:

• तेज बुखार (3 माह से छोटे बच्चे में 100.4°F से अधिक बुखार)
• तेज-तेज सांस लेना या पसलियों का अंदर धंसना
• अत्यधिक सुस्ती, कमजोरी या जगाने में कठिनाई होना
• लगातार उल्टी होना या दूध बिल्कुल न पचना
• आंखें और त्वचा का अत्यधिक पीला होना (गंभीर पीलिया)
• 24 घंटे में 4 से कम बार पेशाब करना (डिहाइड्रेशन का संकेत)

केएमसी अस्पताल 24x7 आपातकालीन हेल्पलाइन: +91 8303666400।`,
  },
  {
    id: "ht4",
    title: "Post-Surgery Recovery & Wound Care for Children",
    title_hi: "बच्चों की सर्जरी के बाद देखभाल एवं घाव की सुरक्षा",
    summary: "How to properly care for your child after a minor or major surgical procedure.",
    summary_hi: "ऑपरेशन के बाद बच्चे की त्वरित रिकवरी और घाव की सही देखभाल के नियम।",
    category: "Pediatric Surgery",
    category_hi: "बाल शल्य चिकित्सा",
    readTime: "3 min read",
    readTime_hi: "3 मिनट पढ़ें",
    author: "Dr. Ajay Kumar Verma",
    author_hi: "डॉ. अजय कुमार वर्मा",
    content: `Proper home care ensures smooth healing after pediatric surgery:

1. Keep Dressing Clean and Dry: Do not bathe or submerge the surgical area until instructed by the surgeon.
2. Pain Management: Administer prescribed analgesics on time as advised. Never give over-the-counter adult medications.
3. Nutrition & Fluid: Encourage light, easy-to-digest fluids initially, gradually progressing to a normal balanced diet.
4. Activity Restriction: Prevent strenuous running, jumping, or sports until the follow-up visit.
5. Follow-Up: Visit KMC Hospital on your scheduled follow-up date for suture inspection and dressing changes.`,
    content_hi: `सर्जरी के बाद घर पर सही देखभाल से बच्चा जल्दी और बिना किसी संक्रमण के ठीक होता है:

1. घाव की पट्टी को सूखा रखें: जब तक सर्जन अनुमति न दें, ऑपरेशन वाली जगह पर पानी न लगने दें।
2. दर्द निवारक दवाएं: डॉक्टर द्वारा लिखी गई दवाएं समय पर दें। कभी भी अपनी मर्जी से कोई वयस्क दवा न दें।
3. सुपाच्य भोजन व तरल पदार्थ: शुरुआत में हल्का और आसानी से पचने वाला भोजन व पर्याप्त पानी दें।
4. खेलकूद पर नियंत्रण: टांके ठीक होने तक बच्चे को तेज दौड़ने, कूदने या भारी खेल खेलने से रोकें।
5. नियमित फॉलो-अप: निर्धारित तारीख पर केएमसी अस्पताल आकर टांके और घाव की जांच अवश्य कराएं।`,
  },
];

export const MEDICAL_RECORDS = {
  prescriptions: [
    {
      id: "rx_1",
      date: "02 Sep 2026",
      doctorName: "Dr. Puneet Kumar Tulsyan",
      doctorName_hi: "डॉ. पुनीत कुमार तुलस्यान",
      department: "Neonatology (NICU)",
      department_hi: "नवजात शिशु गहन चिकित्सा (NICU)",
      diagnosis: "Routine Pediatric Checkup & Mild Colic",
      diagnosis_hi: "नियमित बाल स्वास्थ्य जांच एवं पेट में हल्का दर्द (कॉलिक)",
      medicines: [
        "Syp. Colicaid Drops (4 drops before feed, TID)",
        "Vitamin D3 Drops (400 IU daily)",
        "Saline Nasal Drops (SOS for blocked nose)",
      ],
      medicines_hi: [
        "सिरप कोलिकेड ड्रॉप्स (दूध पिलाने से पहले 4 बूंदें, दिन में 3 बार)",
        "विटामिन D3 ड्रॉप्स (400 IU प्रतिदिन)",
        "सेलाइन नेज़ल ड्रॉप्स (नाक बंद होने पर आवश्यकतानुसार)",
      ],
      doctorNotes: "Baby is active and gaining weight normally. Follow-up in 1 month.",
      doctorNotes_hi: "शिशु स्वस्थ और सक्रिय है तथा वजन सामान्य रूप से बढ़ रहा है। 1 माह बाद फॉलो-अप।",
    },
    {
      id: "rx_2",
      date: "14 Aug 2026",
      doctorName: "Dr. Neeta Khare",
      doctorName_hi: "डॉ. नीता खरे",
      department: "Obstetrics & Gynaecology",
      department_hi: "प्रसूति एवं स्त्री रोग विभाग",
      diagnosis: "Antenatal Trimester Checkup",
      diagnosis_hi: "प्रसव पूर्व द्वितीय तिमाही नियमित जांच",
      medicines: [
        "Tab. Folic Acid + Methylcobalamin (OD)",
        "Tab. Calcium Carbonate 500mg (BD after meals)",
        "Cap. Iron & Zinc (OD after dinner)",
      ],
      medicines_hi: [
        "टैबलेट फोलिक एसिड + मिथाइलकोबालामिन (रोजाना 1 बार)",
        "टैबलेट कैल्शियम कार्बोनेट 500mg (भोजन के बाद दिन में 2 बार)",
        "कैप्सूल आयरन एवं जिंक (रात के खाने के बाद 1 बार)",
      ],
      doctorNotes: "BP: 118/76 mmHg. Routine 2nd Trimester Ultrasound advised.",
      doctorNotes_hi: "रक्तचाप: 118/76 mmHg सामान्य। द्वितीय तिमाही अल्ट्रासाउंड कराने की सलाह।",
    },
  ],
  labReports: [
    {
      id: "lab_1",
      testName: "Complete Blood Count (CBC)",
      testName_hi: "कम्प्लीट ब्लड काउंट (CBC)",
      date: "02 Sep 2026",
      doctor: "Dr. Puneet Kumar Tulsyan",
      doctor_hi: "डॉ. पुनीत कुमार तुलस्यान",
      status: "Normal",
      status_hi: "सामान्य",
      keyResults: "Hemoglobin: 12.4 g/dL | TLC: 7,800 /uL | Platelets: 2.8 Lakhs",
      keyResults_hi: "हीमोग्लोबिन: 12.4 g/dL | टीएलसी: 7,800 /uL | प्लेटलेट्स: 2.8 लाख (सामान्य)",
    },
    {
      id: "lab_2",
      testName: "Obstetric Ultrasound (USG Growth Scan)",
      testName_hi: "प्रसव पूर्व 4D अल्ट्रासाउंड (USG ग्रोथ स्कैन)",
      date: "14 Aug 2026",
      doctor: "Dr. Neeta Khare",
      doctor_hi: "डॉ. नीता खरे",
      status: "Normal",
      status_hi: "सामान्य",
      keyResults: "Single live intrauterine fetus. Normal liquor & cardiac activity.",
      keyResults_hi: "गर्भस्थ शिशु सुरक्षित एवं स्वस्थ। सामान्य धड़कन एवं एमनियोटिक द्रव्य।",
    },
    {
      id: "lab_3",
      testName: "Thyroid Profile (TSH, Free T3, Free T4)",
      testName_hi: "थायरॉयड प्रोफाइल (TSH, Free T3, Free T4)",
      date: "10 Jul 2026",
      doctor: "Dr. Neeta Khare",
      doctor_hi: "डॉ. नीता खरे",
      status: "Normal",
      status_hi: "सामान्य",
      keyResults: "TSH: 2.15 uIU/mL (Well within target pregnancy range).",
      keyResults_hi: "टीएसएच: 2.15 uIU/mL (गर्भावस्था के लिए निर्धारित सामान्य सीमा में)।",
    },
  ],
  vaccinations: [
    {
      id: "vac_1",
      vaccineName: "BCG, OPV-0, Hepatitis B",
      vaccineName_hi: "बीसीजी (BCG), पोलियो (OPV-0), हेपेटाइटिस B",
      givenAt: "At Birth",
      givenAt_hi: "जन्म के समय",
      status: "Completed",
      status_hi: "पूर्ण",
      dateGiven: "15 Jan 2026",
    },
    {
      id: "vac_2",
      vaccineName: "Pentavalent-1, Rotavirus-1, PCV-1",
      vaccineName_hi: "पेंटावेलेंट-1, रोटावायरस-1, पीसीवी-1",
      givenAt: "6 Weeks",
      givenAt_hi: "6 सप्ताह पर",
      status: "Completed",
      status_hi: "पूर्ण",
      dateGiven: "28 Feb 2026",
    },
    {
      id: "vac_3",
      vaccineName: "Pentavalent-2, Rotavirus-2",
      vaccineName_hi: "पेंटावेलेंट-2, रोटावायरस-2",
      givenAt: "10 Weeks",
      givenAt_hi: "10 सप्ताह पर",
      status: "Completed",
      status_hi: "पूर्ण",
      dateGiven: "12 Apr 2026",
    },
    {
      id: "vac_4",
      vaccineName: "Pentavalent-3, Rotavirus-3, PCV-2",
      vaccineName_hi: "पेंटावेलेंट-3, रोटावायरस-3, पीसीवी-2",
      givenAt: "14 Weeks",
      givenAt_hi: "14 सप्ताह पर",
      status: "Completed",
      status_hi: "पूर्ण",
      dateGiven: "24 May 2026",
    },
    {
      id: "vac_5",
      vaccineName: "MR-1 (Measles-Rubella), Vitamin A",
      vaccineName_hi: "एमआर-1 (खसरा-रूबेला), विटामिन A",
      givenAt: "9 Months",
      givenAt_hi: "9 माह पर",
      status: "Upcoming",
      status_hi: "आगामी देय",
      dueDate: "Oct 2026",
    },
  ],
};

export const BILLING_RECORDS = [
  {
    id: "inv_1042",
    invoiceNo: "INV-2026-1042",
    date: "02 Sep 2026",
    service: "Pediatric Consultation & CBC Lab Test",
    service_hi: "बाल रोग परामर्श एवं सीबीसी लैब जांच",
    doctor: "Dr. Puneet Kumar Tulsyan",
    doctor_hi: "डॉ. पुनीत कुमार तुलस्यान",
    amount: "₹1,450",
    status: "Paid",
    status_hi: "भुगतान हो गया",
    paymentMode: "UPI / Online",
    paymentMode_hi: "यूपीआई / ऑनलाइन",
  },
  {
    id: "inv_0984",
    invoiceNo: "INV-2026-0984",
    date: "14 Aug 2026",
    service: "Obstetrics Consultation & 4D Scan",
    service_hi: "स्त्री रोग परामर्श एवं 4D अल्ट्रासाउंड",
    doctor: "Dr. Neeta Khare",
    doctor_hi: "डॉ. नीता खरे",
    amount: "₹2,200",
    status: "Paid",
    status_hi: "भुगतान हो गया",
    paymentMode: "Debit Card",
    paymentMode_hi: "डेबिट कार्ड",
  },
  {
    id: "inv_0872",
    invoiceNo: "INV-2026-0872",
    date: "10 Jul 2026",
    service: "Thyroid & Metabolic Lab Panel",
    service_hi: "थायरॉयड एवं मेटाबॉलिक लैब जांच",
    doctor: "Dr. Neeta Khare",
    doctor_hi: "डॉ. नीता खरे",
    amount: "₹850",
    status: "Paid",
    status_hi: "भुगतान हो गया",
    paymentMode: "Cash",
    paymentMode_hi: "नकद",
  },
];

export const FAQS = [
  {
    q: "What are the visiting hours for inpatients at KMC Hospital?",
    q_hi: "केएमसी अस्पताल में भर्ती मरीजों से मिलने का समय क्या है?",
    a: "Visiting hours are 05:00 PM to 07:00 PM daily. Only one visitor is permitted at a time in the NICU and ICU wards to maintain a sterile environment for newborns.",
    a_hi: "भर्ती मरीजों से मिलने का समय प्रतिदिन शाम 05:00 से शाम 07:00 बजे तक है। नवजात शिशुओं की सुरक्षा और संक्रमण-मुक्त वातावरण बनाए रखने के लिए एनआईसीयू और आईसीयू में एक समय में केवल एक ही आगंतुक को अनुमति है।",
  },
  {
    q: "Does KMC Hospital provide cashless insurance & Mediclaim?",
    q_hi: "क्या केएमसी अस्पताल में कैशलेस इंश्योरेंस और मेडिक्लेम की सुविधा है?",
    a: "Yes, KMC Hospital is empaneled with major TPAs and health insurance providers for cashless maternity and pediatric hospitalization. Please visit our TPA helpdesk on the ground floor.",
    a_hi: "हाँ, केएमसी अस्पताल प्रमुख टीपीए (TPA) एवं स्वास्थ्य बीमा कंपनियों के साथ संबद्ध है। प्रसव एवं बच्चों के इलाज हेतु कैशलेस सुविधा के लिए भूतल (ग्राउंड फ्लोर) स्थित टीपीए डेस्क से संपर्क करें।",
  },
  {
    q: "Is emergency delivery and ambulance available 24x7?",
    q_hi: "क्या 24 घंटे आपातकालीन प्रसव और एम्बुलेंस सुविधा उपलब्ध है?",
    a: "Yes, our emergency labor room, operation theater, and neonatal transport ambulance are active 24 hours a day, 365 days a year. Call +91 8303666400 anytime.",
    a_hi: "हाँ, हमारा आपातकालीन लेबर रूम, ऑपरेशन थिएटर और इनक्यूबेटर युक्त नवजात एम्बुलेंस 24 घंटे, 365 दिन सक्रिय रहते हैं। किसी भी समय +91 8303666400 पर कॉल करें।",
  },
  {
    q: "How can I book an appointment with Dr. Puneet Kumar Tulsyan or Dr. Neeta Khare?",
    q_hi: "डॉ. पुनीत कुमार तुलस्यान या डॉ. नीता खरे से अपॉइंटमेंट कैसे बुक करें?",
    a: "You can book directly through this app by selecting 'Book Appointment' or calling our reception at +91 8303666400.",
    a_hi: "आप सीधे इस ऐप के माध्यम से 'अपॉइंटमेंट बुक करें' चुनकर या हमारे रिसेप्शन नंबर +91 8303666400 पर कॉल करके बुक कर सकते हैं।",
  },
  {
    q: "Can I consult via Video Call from home?",
    q_hi: "क्या मैं घर बैठे वीडियो कॉल द्वारा परामर्श ले सकता हूँ?",
    a: "Yes! Use the 'Video Consult' tab in this app to connect with specialists for follow-ups and routine consultations without leaving home.",
    a_hi: "हाँ! बिना अस्पताल आए घर बैठे विशेषज्ञों से फॉलो-अप व नियमित जांच के लिए इस ऐप के 'वीडियो परामर्श' टैब का उपयोग करें।",
  },
];

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Localized getters that automatically return Hindi or English content based on language
export const getLocalizedQuickServices = (lang = "en") => {
  const isHi = lang === "hi";
  return QUICK_SERVICES.map((s) => ({
    ...s,
    title: isHi && s.title_hi ? s.title_hi : s.title,
    shortDesc: isHi && s.shortDesc_hi ? s.shortDesc_hi : s.shortDesc,
    fullDesc: isHi && s.fullDesc_hi ? s.fullDesc_hi : s.fullDesc,
    highlights: isHi && s.highlights_hi ? s.highlights_hi : s.highlights,
    timings: isHi && s.timings_hi ? s.timings_hi : s.timings,
  }));
};

export const getLocalizedDepartments = (lang = "en") => {
  const isHi = lang === "hi";
  return DEPARTMENTS.map((d) => ({
    ...d,
    name: isHi && d.name_hi ? d.name_hi : d.name,
    overview: isHi && d.overview_hi ? d.overview_hi : d.overview,
    facilities: isHi && d.facilities_hi ? d.facilities_hi : d.facilities,
  }));
};

export const getLocalizedDoctors = (docListOrLang = DOCTORS, lang = "en") => {
  let docList = DOCTORS;
  let activeLang = lang;

  if (typeof docListOrLang === "string") {
    activeLang = docListOrLang;
    docList = DOCTORS;
  } else if (Array.isArray(docListOrLang)) {
    docList = docListOrLang.length > 0 ? docListOrLang : DOCTORS;
  }

  const isHi = activeLang === "hi";

  const cleanName = (n) =>
    (n || "")
      .toLowerCase()
      .replace(/dr\.|dr|prof\.\s*\(dr\.\)|prof\.|prof|डॉ\.|डॉ/g, "")
      .trim();

  return docList.map((doc) => {
    if (!doc) return doc;
    const docClean = cleanName(doc.name);

    // Match by name similarity first, then ID
    const base =
      DOCTORS.find((b) => {
        const bClean = cleanName(b.name);
        return bClean && docClean && (bClean === docClean || bClean.includes(docClean) || docClean.includes(bClean));
      }) || DOCTORS.find((b) => b.id === doc.id);

    const translateGenericDept = (dept) => {
      const d = (dept || "").toLowerCase();
      if (d.includes("obstetric") || d.includes("gynae") || d.includes("स्त्री"))
        return "प्रसूति एवं स्त्री रोग विभाग";
      if (d.includes("nicu") || d.includes("neonat") || d.includes("नवजात"))
        return "नवजात शिशु गहन चिकित्सा (NICU)";
      if (d.includes("pediatric surg") || d.includes("शल्य"))
        return "बाल शल्य चिकित्सा विभाग";
      if (d.includes("pediatric") || d.includes("picu") || d.includes("बाल"))
        return "बाल रोग एवं पीआईसीयू (PICU)";
      if (d.includes("ortho") || d.includes("हड्डी"))
        return "हड्डी एवं जोड़ रोग (ऑर्थोपेडिक्स)";
      if (d.includes("general surg") || d.includes("लेप्रोस्कोपिक"))
        return "सामान्य एवं लेप्रोस्कोपिक सर्जरी";
      if (d.includes("emergency") || d.includes("trauma") || d.includes("आपातकालीन"))
        return "आपातकालीन एवं ट्रॉमा सेवा";
      return dept;
    };

    const translateGenericSpecialty = (spec) => {
      const s = (spec || "").toLowerCase();
      if (s.includes("neonatologist") || s.includes("pediatrician"))
        return "नवजात शिशु एवं बाल रोग विशेषज्ञ";
      if (s.includes("obs") || s.includes("gynae"))
        return "वरिष्ठ स्त्री एवं प्रसूति रोग विशेषज्ञ";
      if (s.includes("orthopaedic"))
        return "वरिष्ठ हड्डी एवं जोड़ रोग विशेषज्ञ";
      if (s.includes("pediatric surg"))
        return "बाल शल्य चिकित्सा विशेषज्ञ";
      if (s.includes("laparoscopic") || s.includes("general surg"))
        return "सामान्य एवं लेप्रोस्कोपिक सर्जन";
      if (s.includes("senior consultant"))
        return "वरिष्ठ परामर्शदाता चिकित्सक";
      return spec;
    };

    const finalName = isHi
      ? (doc.name_hi ||
        base?.name_hi ||
        (doc.name
          ? doc.name.startsWith("Dr")
            ? doc.name.replace(/^Dr\.?\s*/, "डॉ. ")
            : doc.name
          : doc.name))
      : doc.name;

    const finalSpecialty = isHi
      ? (doc.specialty_hi ||
        base?.specialty_hi ||
        translateGenericSpecialty(doc.specialty || doc.specialization))
      : (doc.specialty || doc.specialization);

    const finalDept = isHi
      ? (doc.department_hi || base?.department_hi || translateGenericDept(doc.department))
      : doc.department;

    const finalExp = isHi
      ? (doc.experience_hi ||
        base?.experience_hi ||
        (doc.experience
          ? `${doc.experience.replace(/yrs?/i, "वर्ष")} अनुभव`
          : "10+ वर्ष अनुभव"))
      : doc.experience;

    const finalDays = isHi
      ? (doc.availableDays_hi ||
        base?.availableDays_hi ||
        "सोमवार - शनिवार (सुबह 10:00 - शाम 07:00)")
      : (doc.availableDays || "Mon - Sat");

    const finalAbout = isHi
      ? (doc.about_hi ||
        base?.about_hi ||
        "केएमसी अस्पताल, जानकीपुरम, लखनऊ के वरिष्ठ एवं अनुभवी चिकित्सक।")
      : (doc.about || doc.bio);

    return {
      ...doc,
      name: finalName,
      specialty: finalSpecialty,
      specialization: finalSpecialty,
      experience: finalExp,
      department: finalDept,
      availableDays: finalDays,
      about: finalAbout,
      isOnline: doc.isOnline !== undefined ? Boolean(doc.isOnline) : Boolean(doc.is_online),
      is_online: doc.is_online !== undefined ? Boolean(doc.is_online) : Boolean(doc.isOnline),
      rating: undefined,
      reviewsCount: undefined,
    };
  });
};

export const getLocalizedHealthTips = (lang = "en") => {
  const isHi = lang === "hi";
  return HEALTH_TIPS.map((tip) => ({
    ...tip,
    title: isHi && tip.title_hi ? tip.title_hi : tip.title,
    summary: isHi && tip.summary_hi ? tip.summary_hi : tip.summary,
    category: isHi && tip.category_hi ? tip.category_hi : tip.category,
    readTime: isHi && tip.readTime_hi ? tip.readTime_hi : tip.readTime,
    author: isHi && tip.author_hi ? tip.author_hi : tip.author,
    content: isHi && tip.content_hi ? tip.content_hi : tip.content,
  }));
};

export const getLocalizedFaqs = (lang = "en") => {
  const isHi = lang === "hi";
  return FAQS.map((faq) => ({
    ...faq,
    q: isHi && faq.q_hi ? faq.q_hi : faq.q,
    a: isHi && faq.a_hi ? faq.a_hi : faq.a,
  }));
};

export const getLocalizedMedicalRecords = (lang = "en") => {
  const isHi = lang === "hi";
  return {
    prescriptions: MEDICAL_RECORDS.prescriptions.map((p) => ({
      ...p,
      doctorName: isHi && p.doctorName_hi ? p.doctorName_hi : p.doctorName,
      department: isHi && p.department_hi ? p.department_hi : p.department,
      diagnosis: isHi && p.diagnosis_hi ? p.diagnosis_hi : p.diagnosis,
      medicines: isHi && p.medicines_hi ? p.medicines_hi : p.medicines,
      doctorNotes: isHi && p.doctorNotes_hi ? p.doctorNotes_hi : p.doctorNotes,
    })),
    labReports: MEDICAL_RECORDS.labReports.map((l) => ({
      ...l,
      testName: isHi && l.testName_hi ? l.testName_hi : l.testName,
      doctor: isHi && l.doctor_hi ? l.doctor_hi : l.doctor,
      status: isHi && l.status_hi ? l.status_hi : l.status,
      keyResults: isHi && l.keyResults_hi ? l.keyResults_hi : l.keyResults,
    })),
    vaccinations: MEDICAL_RECORDS.vaccinations.map((v) => ({
      ...v,
      vaccineName: isHi && v.vaccineName_hi ? v.vaccineName_hi : v.vaccineName,
      givenAt: isHi && v.givenAt_hi ? v.givenAt_hi : v.givenAt,
      status: isHi && v.status_hi ? v.status_hi : v.status,
    })),
  };
};

export const getLocalizedBillingRecords = (lang = "en") => {
  const isHi = lang === "hi";
  return BILLING_RECORDS.map((b) => ({
    ...b,
    service: isHi && b.service_hi ? b.service_hi : b.service,
    doctor: isHi && b.doctor_hi ? b.doctor_hi : b.doctor,
    status: isHi && b.status_hi ? b.status_hi : b.status,
    paymentMode: isHi && b.paymentMode_hi ? b.paymentMode_hi : b.paymentMode,
  }));
};
