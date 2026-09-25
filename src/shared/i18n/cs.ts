export const cs = {
  spy: {
    title: 'Spy vs Spy',
    white: 'Bílý',
    black: 'Černý',
    levelLabel: 'Úroveň',
    levelOption: (level: number, cols: number, rows: number) => `${level} (${cols}×${rows})`,
    levelReadout: (rooms: number, traps: number, minutes: number) => `${rooms} místností · ${traps} pastí · ${minutes} min`,
    hideAirport: 'Skrýt letiště',
    mute: 'Ztlumit zvuk',
    music: 'Hudba',
    waiting: 'čeká…',
    joinHint: 'Každý hráč stiskne svou Akci (F / Enter / A na gamepadu)',
    startHint: 'Oba připojeni — stiskni Akci pro start',
    devices: {
      kbLeft: 'klávesnice vlevo',
      kbRight: 'klávesnice vpravo',
      pad: (n: number) => `gamepad ${n}`,
    },
    controls:
      'Bílý: WASD, F akce, G pasti · Černý: šipky, Enter akce, pravý Ctrl pasti · ' +
      'Gamepad: A akce, X pasti, Start pauza · Akce u nábytku: hledat, s věcí v ruce ji tam schováš · Esc pauza · F1 ladění' +
      ' · Stejná past znovu = odzbrojit' +
      ' · Pasti: ťukni G/pravý Ctrl/X = další past do ruky, podrž = mapa, akce u nábytku či dveří = nastražit.' +
      ' Ne před soupeřem.' +
      ' · Souboj: akce = úder (s nahoru rána do hlavy), drž G/pravý Ctrl/X = kryt deštníkem, dolů = přikrčit se',
    back: '← Zpět na hry',
    paused: 'Pauza',
    padLost: 'Ovladač odpojen',
    resumeHint: 'Esc / Start = pokračovat · M = menu',
    tooSmall: 'Zvětši okno',
    out: 'Došel čas',
    map: 'Mapa',
    /** merged view (spec §2): the dark half of the spy who entered a shared room later */
    duel: 'SOUBOJ',
    device: { traps: 'PASTI', map: 'MAPA', remedy: 'OCHRANA', secrets: 'TAJNÉ' },
    things: {
      klic: 'Klíč',
      penize: 'Peníze',
      pas: 'Pas',
      plany: 'Plány',
      kufrik: 'Kufřík',
      voda: 'Kbelík vody',
      kleste: 'Kleště',
      destnik: 'Deštník',
      nuzky: 'Nůžky',
    },
    winner: (name: string) => `${name} utekl!`,
    draw: 'Remíza — oběma došel čas',
    laugh: 'HA HA HA!',
    mobShout: 'CHYŤTE HO!',
    caught: (name: string) => `${name} zůstal v ambasádě…`,
    rematchHint: 'Akce = odveta · Esc = menu',
    timeLeft: (clock: string) => `Zbývající čas: ${clock}`,
    seed: 'Seed',
    /** Result screen (spec §7): one line per spy, winner (or Bílý on a draw) first. */
    scoreLine: (name: string, score: number, rank: string) => `${name}: ${score} b. · ${rank}`,
    rooms: {
      kancelar: 'Kancelář',
      knihovna: 'Knihovna',
      salonek: 'Salonek',
      archiv: 'Archiv',
      konferencni: 'Konferenční sál',
      kuchynka: 'Kuchyňka',
      sifrovna: 'Šifrovací místnost',
      pracovna: 'Velvyslancova pracovna',
    },
    hosts: {
      cs: 'Velvyslanectví Československé republiky',
      pl: 'Velvyslanectví Polské republiky',
      de: 'Velvyslanectví Německé říše (Výmarská republika)',
      hu: 'Velvyslanectví Maďarského království',
      /** Rakouská republika, ≤ 1933 (before the Ständestaat). See `atStandestaat` for 1934+. */
      at: 'Velvyslanectví Rakouské republiky',
    },
    /** Austria became the Ständestaat in 1934; the embassy's name changes with it (1934–1937). */
    atStandestaat: 'Velvyslanectví Spolkového státu Rakousko',
    /** The embassy name for `host`, accounting for Austria's 1934 regime change. */
    hostName: (host: 'cs' | 'pl' | 'de' | 'hu' | 'at', year: number): string =>
      host === 'at' && year >= 1934 ? cs.spy.atStandestaat : cs.spy.hosts[host],
    /** Match title card, e.g. „Velvyslanectví Polské republiky · Praha 1934". */
    titleCard: (host: 'cs' | 'pl' | 'de' | 'hu' | 'at', year: number) => `${cs.spy.hostName(host, year)} · ${cs.spy.city} ${year}`,
    city: 'Praha',
    subtitle: 'Praha, 193x',
    furniture: {
      stul: 'Psací stůl',
      knihovna: 'Knihovna',
      lampa: 'Stojací lampa',
      pohovka: 'Pohovka',
      trezor: 'Trezor',
      obraz: 'Obraz',
      skrin: 'Skříň',
      vesak: 'Věšák',
      kartoteka: 'Kartotéka',
      gramofon: 'Gramofon',
      globus: 'Globus',
      kredenc: 'Kredenc',
      radio: 'Rádio',
      kvetina: 'Květina',
      krb: 'Krb',
      telefon: 'Telefon',
      hasicak: 'Hasičská skříňka',
      naradi: 'Bedna na nářadí',
      lekarnicka: 'Lékárnička',
    },
    traps: {
      bomba: 'Bomba',
      pruzina: 'Pružina',
      elektrina: 'Elektrický kbelík',
      pistole: 'Pistole na provázku',
      casovana: 'Časovaná bomba',
    },
  },
};
