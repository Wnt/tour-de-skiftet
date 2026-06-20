/* Tour de Skiftet — trip data (counter-clockwise: Kustavi → Brändö → Houtskär → Iniö → Kustavi)
   Schedules verified June 2026 from Ålandstrafiken & Finferries official PDFs (see TRIP.sources).
   Ferry times are a planning aid — always (re)book and confirm with the operator. */
window.TRIP = {
  meta: {
    direction: 'Myötäpäivään',
    tripStart: '2026-06-22',   // ride day 1 — Iniö (poutainen)
    tripEnd: '2026-06-23',     // ride day 2 — Brändö (paras pyöräsää)
    updated: '2026-06-20',
    season: 'Kesä 2026',
    ebikeKmh: 20,        // sähköpyörän realistinen keskinopeus
    breakMinPerHour: 15  // vähintään 15 min tauko / tunti
  },

  /* ---- Places (keys referenced by legs) ---- */
  places: {
    peterzens:   { name: 'Peterzens Boathouse', island: 'Kustavi (Laupunen)', type: 'accommodation', lat: 60.4950, lon: 21.4400 },
    lootholma:   { name: 'Kustavin Lootholma', island: 'Kustavi (Kivimaa)', type: 'accommodation', lat: 60.5293, lon: 21.3701 },
    heponiemi:   { name: 'Heponiemi (lauttaranta)', island: 'Kustavi', type: 'ferryTerminal', lat: 60.4851, lon: 21.4351 },
    kivimaa:     { name: 'Kivimaa (Kustavin keskusta)', island: 'Kustavi', type: 'town', lat: 60.5449, lon: 21.3556 },
    vartsala:    { name: 'Vartsala (lossiranta)', island: 'Kustavi', type: 'ferryTerminal', lat: 60.5410, lon: 21.3195 },
    vartsala_e:  { name: 'Kivimaan lossiranta', island: 'Kustavi', type: 'ferryTerminal', lat: 60.5426, lon: 21.3360 },
    osnas:       { name: 'Osnäs / Vuosnainen (lauttaranta)', island: 'Kustavi', type: 'ferryTerminal', lat: 60.5074, lon: 21.2474 },
    ava:         { name: 'Åva (lauttaranta)', island: 'Brändö', type: 'ferryTerminal', lat: 60.5032, lon: 21.0572 },
    jurmo:       { name: 'Jurmo', island: 'Brändö', type: 'side', lat: 60.5169, lon: 21.0766 },
    brando_kby:  { name: 'Brändön kirkonkylä', island: 'Brändö', type: 'village', lat: 60.4176, lon: 21.0334 },
    torsholma:   { name: 'Torsholma (lauttaranta)', island: 'Brändö', type: 'ferryTerminal', lat: 60.3566, lon: 21.0382 },
    lappo:       { name: 'Lappo', island: 'Brändö', type: 'side', lat: 60.3170, lon: 20.9920 },
    asterholma:  { name: 'Asterholma', island: 'Brändö', type: 'side', lat: 60.3042, lon: 21.0375 },
    roslax:      { name: 'Roslax (lauttaranta)', island: 'Houtskär', type: 'ferryTerminal', lat: 60.2337, lon: 21.3348 },
    nasby:       { name: 'Näsby (Houtskärin keskusta)', island: 'Houtskär', type: 'town', lat: 60.2246, lon: 21.3721 },
    bjorko:      { name: 'Björkö', island: 'Houtskär', type: 'village', lat: 60.2655, lon: 21.4051 },
    mossala:     { name: 'Mossala (lauttaranta)', island: 'Houtskär', type: 'ferryTerminal', lat: 60.2883, lon: 21.4397 },
    dalen:       { name: 'Dalen (lauttaranta)', island: 'Iniö', type: 'ferryTerminal', lat: 60.3817, lon: 21.3717 },
    skagen:      { name: 'Skagen (lossi)', island: 'Iniö', type: 'ferryTerminal', lat: 60.4060, lon: 21.3685 },
    jumo:        { name: 'Jumo (lauttaranta)', island: 'Iniö', type: 'ferryTerminal', lat: 60.4116, lon: 21.3699 },
    kannvik:     { name: 'Kannvik (lauttaranta)', island: 'Iniö', type: 'ferryTerminal', lat: 60.4393, lon: 21.3960 }
  },

  /* ---- Legs in travel order (counter-clockwise) ---- */
  legs: [
    // DAY 1 — Ma 22.6  Kustavi → Iniö → Houtskär  (poutainen)
    { day: 1, from: 'peterzens', to: 'heponiemi', mode: 'bike',  km: 1.3,  island: 'Kustavi', note: 'Lauttarantaan' },
    { day: 1, from: 'heponiemi', to: 'kannvik',   mode: 'ferry', km: 10,   ferry: 'sterna', note: 'Maksuton, ei varausta' },
    { day: 1, from: 'kannvik',   to: 'jumo',      mode: 'bike',  km: 4.1,  island: 'Iniö', note: '' },
    { day: 1, from: 'jumo',      to: 'skagen',    mode: 'ferry', km: 0.6,  ferry: 'skagen_jumo', note: 'Kaapelilossi, tarvittaessa' },
    { day: 1, from: 'skagen',    to: 'dalen',     mode: 'bike',  km: 4.4,  island: 'Iniö', note: '' },
    { day: 1, from: 'dalen',     to: 'mossala',   mode: 'ferry', km: 12,   ferry: 'replot', note: 'Maksullinen (pyörä 12 €)' },
    { day: 1, from: 'mossala',   to: 'nasby',     mode: 'bike',  km: 16.4, island: 'Houtskär', note: '' },
    // DAY 2 — Ti 23.6  Houtskär → Brändö → Kustavi  (paras pyöräsää)
    { day: 2, from: 'nasby',     to: 'roslax',    mode: 'bike',  km: 5,    island: 'Houtskär', note: 'Suora maantie Roslaxin lauttarantaan — ei kaapelilossia' },
    { day: 2, from: 'roslax',    to: 'torsholma', mode: 'ferry', km: 55,   ferry: 'skiftet', note: 'Houtskärin reitti ~2 h (m/s Rosala 2) — varaa edellisenä päivänä klo 17' },
    { day: 2, from: 'torsholma', to: 'brando_kby',mode: 'bike',  km: 8.6,  island: 'Brändö', note: '' },
    { day: 2, from: 'brando_kby',to: 'ava',       mode: 'bike',  km: 12.5, island: 'Brändö', note: 'Lounastauko' },
    { day: 2, from: 'ava',       to: 'osnas',     mode: 'ferry', km: 25,   ferry: 'adan',   note: 'Ådan — maksuton tähän suuntaan' },
    { day: 2, from: 'osnas',     to: 'kivimaa',   mode: 'bike',  km: 9.5,  island: 'Kustavi', note: '' },
    { day: 2, from: 'kivimaa',   to: 'peterzens', mode: 'bike',  km: 11.4, island: 'Kustavi', note: 'Takaisin lähtöpisteeseen' }
  ],

  /* ---- Side trips (drawn dashed, not on main line) ---- */
  spurs: [
    { from: 'ava', to: 'jurmo', km: 'lautta' },
    { from: 'torsholma', to: 'lappo', km: 'lautta' }
  ],

  /* ---- Ferries (schedules: dow = weekday numbers 0=Su..6=Sa) ---- */
  ferries: {
    adan: {
      name: 'Osnäs (Vuosnainen) ↔ Åva',
      operator: 'Ålandstrafiken · M/S Ådan',
      crossingMin: 45,
      booking: 'yes',
      bookingUrl: 'https://boka.alandstrafiken.ax',
      bookingProvider: 'Ålandstrafiken',
      price: 'Maksullinen suuntaan Osnäs→Åva (pyörä 4,80 € verkossa / 6 €, matkustaja ilman ajoneuvoa maksuton). Paluusuunta Åva→Osnäs maksuton.',
      note: 'VARAUS PAKOLLINEN — ilman ennakkolippua ei pääse laivaan. Kesäaikataulu 6.6.–18.8.2026. Vahvista ajat ja varaa: alandstrafiken.ax tai +358 18 25 600.',
      links: [
        { label: 'Varaa / aikataulu (Ålandstrafiken)', url: 'https://www.alandstrafiken.ax/farjetrafik/farjornas-turlistor' },
        { label: 'Varausportaali', url: 'https://boka.alandstrafiken.ax' }
      ],
      schedules: [
        { direction: 'Osnäs → Åva', from: 'osnas', to: 'ava', days: 'Ma', dow: [1], season: 'Kesä', times: ['10:05', '13:40', '16:35', '18:40'] },
        { direction: 'Osnäs → Åva', from: 'osnas', to: 'ava', days: 'Ti–La', dow: [2, 3, 4, 5, 6], season: 'Kesä', times: ['06:30', '10:35', '13:35', '16:35', '19:40'] },
        { direction: 'Osnäs → Åva', from: 'osnas', to: 'ava', days: 'Su', dow: [0], season: 'Kesä', times: ['10:35', '12:45', '16:05', '19:00'] },
        { direction: 'Åva → Osnäs', from: 'ava', to: 'osnas', days: 'Ma', dow: [1], season: 'Kesä', times: ['07:05', '12:35', '15:30', '17:30', '20:35'] },
        { direction: 'Åva → Osnäs', from: 'ava', to: 'osnas', days: 'Ti–La', dow: [2, 3, 4, 5, 6], season: 'Kesä', times: ['08:30', '12:30', '15:30', '18:30', '21:35'] },
        { direction: 'Åva → Osnäs', from: 'ava', to: 'osnas', days: 'Su', dow: [0], season: 'Kesä', times: ['11:30', '15:00', '17:30'] }
      ]
    },
    skiftet: {
      name: 'Torsholma ↔ Roslax · Houtskärin reitti',
      operator: 'Finferries · m/s Rosala 2',
      crossingMin: 135,
      booking: 'yes',
      bookingUrl: 'https://booking.finferries.fi',
      bookingProvider: 'Finferries',
      price: 'Maksuton matkustajalle ja pyörälle.',
      note: 'VARAUS PAKOLLINEN viimeistään edellisenä päivänä klo 17 (su-vuorot la klo 14 mennessä) — booking.finferries.fi. Liikennöi VAIN ke, to, pe ja su — ei ma, ti eikä la. Pitkä ulkosaaristoylitys ~2–2,5 h, useita pysähdyksiä. Juhannus: pe 19.6. ja la 20.6. ei liikennettä.',
      links: [
        { label: 'Varaa (Finferries booking)', url: 'https://booking.finferries.fi' },
        { label: 'Houtskärin reitin aikataulu (PDF)', url: 'https://www.finferries.fi/media/aikataulut-2026/houtskarin-reitti-kesa-6.6.-18.8.2026.pdf' }
      ],
      schedules: [
        { direction: 'Roslax → Torsholma', from: 'roslax', to: 'torsholma', days: 'Ke, To', dow: [3, 4], season: 'Kesä', times: ['12:35'] },
        { direction: 'Roslax → Torsholma', from: 'roslax', to: 'torsholma', days: 'Pe', dow: [5], season: 'Kesä', times: ['12:35', '18:10'] },
        { direction: 'Roslax → Torsholma', from: 'roslax', to: 'torsholma', days: 'Su', dow: [0], season: 'Kesä', times: ['11:00', '17:40'] },
        { direction: 'Torsholma → Roslax', from: 'torsholma', to: 'roslax', days: 'Ke, To', dow: [3, 4], season: 'Kesä', times: ['15:15'] },
        { direction: 'Torsholma → Roslax', from: 'torsholma', to: 'roslax', days: 'Pe', dow: [5], season: 'Kesä', times: ['15:15', '21:10'] },
        { direction: 'Torsholma → Roslax', from: 'torsholma', to: 'roslax', days: 'Su', dow: [0], season: 'Kesä', times: ['14:20', '20:20'] }
      ]
    },
    replot: {
      name: 'Mossala ↔ Dalen',
      operator: 'Finferries · M/S Replot 2',
      crossingMin: 60,
      booking: 'recommended',
      bookingUrl: 'https://booking.finferries.fi',
      bookingProvider: 'Finferries',
      price: 'Maksullinen: aikuinen 10 €, lapsi 5 €, polkupyörä 12 €, henkilöauto 45 €.',
      note: 'Liikennöi kesäkaudella 8.5.–13.9.2026. Varaus suositeltu paikan varmistamiseksi (booking.finferries.fi tai maksu kyydissä MobilePaylla). Heinäkuun ilta­vuorot (18:45 / 20:00) eivät kulje kesäkuussa.',
      links: [
        { label: 'Varaa (Finferries booking)', url: 'https://booking.finferries.fi' },
        { label: 'Mossala–Dalen aikataulu (PDF)', url: 'https://www.finferries.fi/media/aikataulut-2026/saariston-rengastie-houtskari-inio-8.5.-13.9.2026.pdf' }
      ],
      schedules: [
        { direction: 'Mossala → Dalen', from: 'mossala', to: 'dalen', days: 'Ma–La', dow: [1, 2, 3, 4, 5, 6], season: 'Kesä', times: ['09:15', '12:15', '14:15', '16:15'] },
        { direction: 'Mossala → Dalen', from: 'mossala', to: 'dalen', days: 'Su', dow: [0], season: 'Kesä', times: ['09:15', '11:45', '14:15', '16:15'] },
        { direction: 'Dalen → Mossala', from: 'dalen', to: 'mossala', days: 'Ma–La', dow: [1, 2, 3, 4, 5, 6], season: 'Kesä', times: ['11:15', '13:15', '15:15', '17:45'] },
        { direction: 'Dalen → Mossala', from: 'dalen', to: 'mossala', days: 'Su', dow: [0], season: 'Kesä', times: ['10:15', '13:15', '15:15', '17:45'] }
      ]
    },
    sterna: {
      name: 'Kannvik ↔ Heponiemi',
      operator: 'Finferries · M/S Sterna',
      crossingMin: 30,
      booking: 'no',
      price: 'Maksuton (valtion maantielautta).',
      note: 'Maksuton lossi, ei varausta. Kesäaikataulu 8.5.–13.9.2026. Osa aamuvuoroista (ma/ke/pe) voi olla vaarallisten aineiden kuljetuksia, joissa rajoitettu matkustajamäärä.',
      links: [
        { label: 'Iniö–Kustavi aikataulu (PDF)', url: 'https://www.finferries.fi/media/aikataulut-2026/inio-kustavi-kesa-8.5.-13.9.2026.pdf' }
      ],
      schedules: [
        { direction: 'Kannvik → Heponiemi', from: 'kannvik', to: 'heponiemi', days: 'Ma–Pe', dow: [1, 2, 3, 4, 5], season: 'Kesä', times: ['06:30', '07:30', '09:30', '11:00', '14:45', '15:55', '18:00', '20:30'] },
        { direction: 'Kannvik → Heponiemi', from: 'kannvik', to: 'heponiemi', days: 'La', dow: [6], season: 'Kesä', times: ['07:30', '09:30', '11:00', '14:45', '15:55', '18:00'] },
        { direction: 'Kannvik → Heponiemi', from: 'kannvik', to: 'heponiemi', days: 'Su', dow: [0], season: 'Kesä', times: ['11:00', '13:30', '14:45', '15:55', '17:10', '19:15'] },
        { direction: 'Heponiemi → Kannvik', from: 'heponiemi', to: 'kannvik', days: 'Ma–Pe', dow: [1, 2, 3, 4, 5], season: 'Kesä', times: ['07:00', '08:10', '10:10', '11:45', '15:20', '16:30', '19:00', '21:00'] },
        { direction: 'Heponiemi → Kannvik', from: 'heponiemi', to: 'kannvik', days: 'La', dow: [6], season: 'Kesä', times: ['08:10', '10:10', '11:45', '15:20', '16:30', '19:00'] },
        { direction: 'Heponiemi → Kannvik', from: 'heponiemi', to: 'kannvik', days: 'Su', dow: [0], season: 'Kesä', times: ['11:45', '14:00', '15:20', '16:30', '18:30', '19:55'] }
      ]
    },
    skagen_jumo: {
      name: 'Skagen ↔ Jumo (kaapelilossi)',
      operator: 'Finferries · maantielossi',
      crossingMin: 5,
      booking: 'no',
      price: 'Maksuton.',
      note: 'Pieni kaapelilossi Iniön sisällä, kulkee tarvittaessa (arkisin n. klo 6–23, la 7–23, su 8.30–22). Ei kiinteää aikataulua — odota rannassa tai paina kutsunappia.',
      links: [],
      schedules: [
        { direction: 'Skagen ↔ Jumo', days: 'Tarvittaessa / päivittäin', dow: [0, 1, 2, 3, 4, 5, 6], season: 'Kesä', times: [] }
      ]
    },
    vartsala: {
      name: 'Vartsalan lossi',
      operator: 'Väylä · maantielossi',
      crossingMin: 8,
      booking: 'no',
      price: 'Maksuton (valtion maantielossi).',
      note: 'Pieni maantielossi Vartsalan salmen yli (Osnäs ↔ Kivimaa). Kulkee jatkuvasti, ei kiinteää aikataulua eikä varausta — aja kyytiin rannassa.',
      links: [],
      schedules: [
        { direction: 'Vartsala ↔ Kivimaa', days: 'Jatkuvasti / päivittäin', dow: [0, 1, 2, 3, 4, 5, 6], season: 'Kesä', times: [] }
      ]
    }
  },

  /* ---- Accommodations: the Houtskär night (base-independent). The Kustavi base
     night comes from the selected `bases` entry and is merged in at runtime. ---- */
  accommodations: [
    {
      night: 1, name: 'Restaurang Sybarit & Bed and Breakfast', address: 'Näsbyvägen 189, 21760 Houtskär',
      lat: 60.2228, lon: 21.3685, link: 'https://www.bedandbreakfast.eu/en/a/XvTueNhFQ4O8/bed-breakfast-restaurang-sybarit',
      bookingUrl: 'https://www.booking.com/hotel/fi/bed-amp-breakfast-restaurang-sybarit.html',
      note: 'Houtskär (Näsby), ~200 m vierasvenesatamasta. Ravintola samassa. Yöpyminen päivän 1 jälkeen.'
    }
  ],

  /* ---- Selectable Kustavi base (start/finish). Each base supplies its own
     Kustavi connector legs (CW order) and its lodging. Peterzens sits by the
     Heponiemi (Iniö) ferry → one day is short, the other long. Lootholma is
     central (Kivimaa) → days split far more evenly (~37/39 km). ---- */
  bases: {
    peterzens: {
      key: 'peterzens', label: 'Peterzens', placeKey: 'peterzens',
      dayKm: '26 + 45 km', balance: 'epätasainen',
      toHeponiemi: [ { from: 'peterzens', to: 'heponiemi', mode: 'bike', km: 1.3 } ],
      osnasToBase: [ { from: 'osnas', to: 'vartsala', mode: 'bike', km: 6.4 },
                     { from: 'vartsala', to: 'vartsala_e', mode: 'ferry', km: 0.9, ferry: 'vartsala' },
                     { from: 'vartsala_e', to: 'kivimaa', mode: 'bike', km: 1.3 },
                     { from: 'kivimaa', to: 'peterzens', mode: 'bike', km: 11.4 } ],
      accommodation: {
        name: 'Peterzens Boathouse', address: 'Parattulan rantatie 16, 23360 Kustavi',
        lat: 60.4950, lon: 21.4400, link: 'https://peterzens.com',
        bookingUrl: 'https://www.booking.com/hotel/fi/peterzens-boathouse.html',
        note: 'Kustavi (Laupunen), reissun tukikohta — jätä auto tänne. Aivan Heponiemen lauttarannan vieressä, joten Iniö-päivä jää lyhyeksi ja Brändö-päivä pitkäksi. (Huom: ei Brändöllä/Lapolla.)'
      }
    },
    lootholma: {
      key: 'lootholma', label: 'Lootholma', placeKey: 'lootholma',
      dayKm: '39 + 36 km', balance: 'tasainen',
      toHeponiemi: [ { from: 'lootholma', to: 'heponiemi', mode: 'bike', km: 13.8 } ],
      osnasToBase: [ { from: 'osnas', to: 'vartsala', mode: 'bike', km: 6.4 },
                     { from: 'vartsala', to: 'vartsala_e', mode: 'ferry', km: 0.9, ferry: 'vartsala' },
                     { from: 'vartsala_e', to: 'lootholma', mode: 'bike', km: 3.3 } ],
      accommodation: {
        name: 'Kustavin Lootholma', address: 'Kuninkaantie 193, 23360 Kustavi',
        lat: 60.5293, lon: 21.3701, link: 'https://lootholma.fi', bookingUrl: null,
        note: 'Kustavi (Kivimaa) — leirintä, mökit ja ravintola. Keskeinen sijainti tasaa päivien ajomatkat (~39 + 36 km, kun Peterzensistä 26 + 45 km). Lähellä keskustaa ja palveluita.'
      }
    }
  },

  /* ---- Day-by-day plan ----
     Generated at runtime from the selected option (Vaihtoehdot → Valitse),
     so the day plan always matches the chosen direction & dates. */
  dayPlan: [],

  /* ---- Weather spots (one fetch covers all) ---- */
  weatherSpots: ['peterzens', 'ava', 'nasby', 'kannvik'],

  /* ---- Info notes ---- */
  infoNotes: [
    '☀️ <b>Valitse matkapäivät Vaihtoehdot-välilehdeltä.</b> Sovellus järjestää 2 päivän lenkkivaihtoehdot tuoreen sääennusteen mukaan ja korostaa parhaan Brändö-päivän. Brändö-päivä voi olla vain ke, to, pe tai su (Houtskärin reitin päivät).',
    '🚲 Koko lenkki ~120 km, josta pyöräillen ~69 km — loput meritse lautoilla. Sähköpyörällä (~20 km/h) ja 15 min tauko/tunti pyöräaikaa ~3,5 h. Toinen päivä on selvästi pidempi (Brändö-osuus ~48 km). Maasto on loivaa.',
    '🚗 Autolla Turusta Kustaviin (~1 h); jätä auto Peterzens\'ille (reissun tukikohta). Aja perille matkan ensimmäisenä aamuna ja aloita lenkki sieltä; paluu autolla viimeisen päivän jälkeen.',
    '🎟️ Varaa lautat etukäteen: <b>Houtskärin reitti</b> (Brändö↔Houtskär, m/s Rosala 2) viimeistään edellisenä päivänä klo 17, ja <b>Ådan</b> (Osnäs↔Åva) — molemmat vaativat varauksen. <b>Replot 2</b> (Mossala↔Dalen) on hyvä varata sekin. <b>Sterna</b> (Heponiemi↔Kannvik) on ilmainen eikä vaadi varausta.',
    '⚠️ Houtskärin reitin yhteysalus (Brändö↔Houtskär, m/s Rosala 2) liikennöi <b>vain ke, to, pe ja su</b> — ei ma, ti eikä la. Ylitys ~2–2,5 h. Juhannuksena (pe 19.6. & la 20.6.) ei liikennettä.',
    '🌬️ Tarkista tuuli ennen lähtöä — saaristossa vastatuuli avoimilla pätkillä on isoin rasitus. Tuulen suunta ja nopeus näkyvät Sää-välilehdellä (Ilmatieteen laitoksen ennuste).',
    '🌧️ Sadetutka: Kartta-välilehdellä 🌧️-painike näyttää edellisen tunnin sadealueet animaationa (Ilmatieteen laitoksen tutkadata). Mitä punaisempi, sitä rankempi sade. Vaatii verkkoyhteyden.',
    '💧 Ota mukaan vettä ja eväitä; palvelut ovat saarilla harvassa. Näsbyssä ja Mossalassa on ravintolat, Kustavissa kauppa.',
    '📌 Peterzens Boathouse on Kustavissa (ei Brändöllä) — se toimii lähtö- ja paluupisteenä, ja auton voi jättää siihen.',
    '📴 Sovellus toimii offline-tilassa: avaa kartta kerran verkossa (ruudut tallentuvat), niin reitti, etäisyydet ja aikataulut ovat käytettävissä ilman verkkoa. Viimeksi haettu sääennuste säilyy myös offline.'
  ],

  /* ---- Sources & things to verify ---- */
  dataGaps: [
    'Houtskärin reitti (Brändö↔Houtskär, m/s Rosala 2) on reissun kriittisin yhteys: liikennöi vain ke/to/pe/su, varaus pakollinen viimeistään edellisenä päivänä klo 17 (su-vuorot la klo 14). Vahvista täsmäajat Finferriesin PDF:stä.',
    'Ådan (Osnäs↔Åva): varaus pakollinen — vahvista täsmäaika ja varaa alandstrafiken.ax. Suunta Åva→Osnäs (mantereelle) on maksuton.',
    'Replot 2 (Mossala→Dalen) ja Sterna (Kannvik→Heponiemi): ajat vahvistettu Finferriesin 2026 PDF:istä, mutta tarkista poikkeukset ennen matkaa.',
    'Kaapelilossit (Skagen–Jumo, Björkö–Mossala, Roslax–Kivimo) kulkevat tarvittaessa ilman kiinteää aikataulua.',
    'Joidenkin pienten paikkojen (Brändön kirkonkylä, Kivimo) koordinaatit ovat likimääräisiä.'
  ],
  sources: [
    { label: 'Brändö: saaristolauttojen info & aikataulut', url: 'https://www.brando.ax/info-ja-aikataulut-saaristolautoille/' },
    { label: 'Tour de Skiftet -reitti (brando.ax)', url: 'https://www.brando.ax/tour-de-skiftet-2026-fi/' },
    { label: 'Ådan (Osnäs–Åva) aikataulu & varaus', url: 'https://www.alandstrafiken.ax/farjetrafik/farjornas-turlistor' },
    { label: 'Finferries: Houtskärin reitti (m/s Rosala 2) PDF', url: 'https://www.finferries.fi/media/aikataulut-2026/houtskarin-reitti-kesa-6.6.-18.8.2026.pdf' },
    { label: 'Finferries: Mossala–Dalen PDF', url: 'https://www.finferries.fi/media/aikataulut-2026/saariston-rengastie-houtskari-inio-8.5.-13.9.2026.pdf' },
    { label: 'Finferries: Iniö–Kustavi (Sterna) PDF', url: 'https://www.finferries.fi/media/aikataulut-2026/inio-kustavi-kesa-8.5.-13.9.2026.pdf' },
    { label: 'Saariston Rengastie / Tour de Skiftet', url: 'https://www.rengastie.fi/tour-de-skiftet/' },
    { label: 'Sää & sadetutka: Ilmatieteen laitos (avoin data)', url: 'https://www.ilmatieteenlaitos.fi/avoin-data' }
  ]
};
