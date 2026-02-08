// World Flags Explorer - Main Application

// Create flag hover tooltip element
const flagTooltip = document.createElement('div');
flagTooltip.id = 'flagTooltip';
flagTooltip.innerHTML = `
    <div id="tooltipContent">
        <img id="tooltipFlag" src="" alt="">
        <div id="tooltipName"></div>
    </div>
    <div id="tooltipSubregion" style="display:none; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
        <img id="tooltipSubregionFlag" src="" alt="">
        <div id="tooltipSubregionName"></div>
    </div>
    <div id="tooltipMunicipality" style="display:none; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
        <img id="tooltipMunicipalityFlag" src="" alt="">
        <div id="tooltipMunicipalityName"></div>
    </div>
    <div id="tooltipHint">Click for details</div>
`;
document.body.appendChild(flagTooltip);

// Initialize the map
const map = L.map('map', {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 10,
    worldCopyJump: true
});

// Add tile layer (map background)
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// Create a pane for subregions above the default overlay pane so they receive hover/click events first
map.createPane('subregions');
map.getPane('subregions').style.zIndex = 450;

// GeoJSON layers
let geoJsonLayer;
let subregionLayers = {};
let subSubregionLayers = {};
let selectedCountry = null;
let currentZoom = 2;
// Bounds of each country (from main GeoJSON) for viewport intersection
let countryBounds = {};
// Zoom level at which to show subregions (only for countries in view)
const SUBREGION_MIN_ZOOM = 4;
// Zoom level at which to show sub-subregions (e.g. NL municipalities)
const SUBSUBREGION_MIN_ZOOM = 6;

// Subregion GeoJSON URLs - using reliable sources
// Note: Only countries with confirmed working GeoJSON sources are included
const subregionGeoJSONUrls = {
    'US': 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json',
    'CA': 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson',
    'AU': 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/australia.geojson',
    'DE': 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/germany.geojson',
    'GB': 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/uk-countries.geojson',
    'CH': 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/switzerland-cantons.geojson',
    'NL': 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/the-netherlands.geojson',
    'BE': 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/belgium-provinces.geojson',
    'PL': 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/poland.geojson',
    'LK': 'map.geojson', // Custom Sri Lanka provinces GeoJSON
    'JP': 'https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson', // Japan prefectures
    'KR': 'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/gadm/json/skorea-provinces-geo.json', // South Korea provinces
    'RU': 'https://raw.githubusercontent.com/Hubbitus/RussiaRegions.geojson/master/RussiaRegions.geojson', // Russia federal subjects
    'FR': 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/regions.geojson', // France regions (post-2016, uses nom/code)
    'BR': 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson', // Brazil states
    'BO': 'bolivia-departments.geojson', // Bolivia departments (local)
    'ES': 'spain-ccaa.geojson', // Spain autonomous communities (local; geoBoundaries uses LFS)
    'CR': 'costa-rica-provinces.geojson' // Costa Rica provinces (local)
};

// Sub-subregion (tertiary) GeoJSON URLs - e.g. NL municipalities
const subSubregionGeoJSONUrls = {
    'NL': 'netherlands-municipalities.geojson'
};

// State/Province name to code mapping for US
const usStateNameToCode = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
    'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
    'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
    'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
    'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
    'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
    'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
    'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
    'district of columbia': 'DC', 'puerto rico': 'PR'
};

// Canadian province name to code mapping
const caProvinceNameToCode = {
    'alberta': 'AB', 'british columbia': 'BC', 'manitoba': 'MB', 'new brunswick': 'NB',
    'newfoundland and labrador': 'NL', 'nova scotia': 'NS', 'ontario': 'ON', 'prince edward island': 'PE',
    'quebec': 'QC', 'saskatchewan': 'SK', 'northwest territories': 'NT', 'nunavut': 'NU', 'yukon': 'YT'
};

// Australian state name to code mapping
const auStateNameToCode = {
    'new south wales': 'NSW', 'victoria': 'VIC', 'queensland': 'QLD', 'south australia': 'SA',
    'western australia': 'WA', 'tasmania': 'TAS', 'northern territory': 'NT', 
    'australian capital territory': 'ACT'
};

// UK countries name to code mapping
const gbCountryNameToCode = {
    'england': 'ENG', 'scotland': 'SCT', 'wales': 'WLS', 
    'northern ireland': 'NIR', 'cymru': 'WLS', 'alba': 'SCT'
};

// Sri Lanka provinces name to code mapping
const lkProvinceNameToCode = {
    'western': 'WP', 'western province': 'WP', 'basnahira palata': 'WP', 'basnahira': 'WP',
    'central': 'CP', 'central province': 'CP', 'madhyama palata': 'CP', 'madhyama': 'CP',
    'southern': 'SP', 'southern province': 'SP', 'dakunu palata': 'SP', 'dakunu': 'SP',
    'north western': 'NW', 'north western province': 'NW', 'northwestern': 'NW', 'north-western': 'NW', 'wayamba palata': 'NW', 'wayamba': 'NW',
    'northern': 'NP', 'northern province': 'NP', 'uthuru palata': 'NP', 'uthuru': 'NP',
    'eastern': 'EP', 'eastern province': 'EP', 'negenahira palata': 'EP', 'negenahira': 'EP',
    'north central': 'NC', 'north central province': 'NC', 'northcentral': 'NC', 'north-central': 'NC', 'uturumeda palata': 'NC', 'uturumeda': 'NC',
    'uva': 'UV', 'uva province': 'UV', 'uva palata': 'UV',
    'sabaragamuwa': 'SG', 'sabaragamuwa province': 'SG', 'sabaragamuwa palata': 'SG'
};

// Switzerland cantons name to code mapping
const chCantonNameToCode = {
    'zürich': 'ZH', 'zurich': 'ZH', 'zh': 'ZH',
    'bern': 'BE', 'berne': 'BE', 'be': 'BE',
    'luzern': 'LU', 'lucerne': 'LU', 'lu': 'LU',
    'uri': 'UR', 'ur': 'UR',
    'schwyz': 'SZ', 'sz': 'SZ',
    'obwalden': 'OW', 'ow': 'OW',
    'nidwalden': 'NW', 'nw': 'NW',
    'glarus': 'GL', 'gl': 'GL',
    'zug': 'ZG', 'zg': 'ZG',
    'fribourg': 'FR', 'freiburg': 'FR', 'fr': 'FR',
    'solothurn': 'SO', 'so': 'SO',
    'basel-stadt': 'BS', 'basel stadt': 'BS', 'bs': 'BS',
    'basel-landschaft': 'BL', 'basel landschaft': 'BL', 'bl': 'BL',
    'schaffhausen': 'SH', 'sh': 'SH',
    'appenzell ausserrhoden': 'AR', 'ar': 'AR',
    'appenzell innerrhoden': 'AI', 'ai': 'AI',
    'st. gallen': 'SG', 'st gallen': 'SG', 'sankt gallen': 'SG', 'sg': 'SG',
    'graubünden': 'GR', 'graubuenden': 'GR', 'grisons': 'GR', 'gr': 'GR',
    'aargau': 'AG', 'ag': 'AG',
    'thurgau': 'TG', 'tg': 'TG',
    'ticino': 'TI', 'tessin': 'TI', 'ti': 'TI',
    'vaud': 'VD', 'waadt': 'VD', 'vd': 'VD',
    'valais': 'VS', 'wallis': 'VS', 'vs': 'VS',
    'neuchâtel': 'NE', 'neuchatel': 'NE', 'neuenburg': 'NE', 'ne': 'NE',
    'genève': 'GE', 'geneve': 'GE', 'geneva': 'GE', 'genf': 'GE', 'ge': 'GE',
    'jura': 'JU', 'ju': 'JU'
};

// Netherlands provinces name to code mapping
const nlProvinceNameToCode = {
    'drenthe': 'DR', 'dr': 'DR',
    'flevoland': 'FL', 'fl': 'FL',
    'friesland': 'FR', 'fryslân': 'FR', 'fryslan': 'FR', 'fr': 'FR',
    'gelderland': 'GE', 'ge': 'GE',
    'groningen': 'GR', 'gr': 'GR',
    'limburg': 'LI', 'li': 'LI',
    'noord-brabant': 'NB', 'north brabant': 'NB', 'noord brabant': 'NB', 'nb': 'NB',
    'noord-holland': 'NH', 'north holland': 'NH', 'noord holland': 'NH', 'nh': 'NH',
    'overijssel': 'OV', 'ov': 'OV',
    'zuid-holland': 'ZH', 'south holland': 'ZH', 'zuid holland': 'ZH', 'zh': 'ZH',
    'utrecht': 'UT', 'ut': 'UT',
    'zeeland': 'ZE', 'ze': 'ZE'
};

// Belgium regions name to code mapping
const beRegionNameToCode = {
    'flanders': 'VLG', 'vlaanderen': 'VLG', 'flemish': 'VLG', 'flemish region': 'VLG',
    'wallonia': 'WAL', 'wallonie': 'WAL', 'walloon': 'WAL', 'walloon region': 'WAL',
    'brussels': 'BRU', 'bruxelles': 'BRU', 'brussel': 'BRU', 'brussels-capital': 'BRU'
};

// Poland voivodeships name to code mapping
const plVoivodeshipNameToCode = {
    'dolnośląskie': 'DS', 'lower silesian': 'DS', 'lower silesia': 'DS', 'dolnoslaskie': 'DS',
    'kujawsko-pomorskie': 'KP', 'kuyavian-pomeranian': 'KP', 'kujawsko pomorskie': 'KP',
    'lubelskie': 'LU', 'lublin': 'LU',
    'lubuskie': 'LB', 'lubusz': 'LB',
    'łódzkie': 'LD', 'lodzkie': 'LD', 'łódź': 'LD', 'lodz': 'LD',
    'małopolskie': 'MA', 'lesser poland': 'MA', 'malopolskie': 'MA',
    'mazowieckie': 'MZ', 'masovian': 'MZ', 'masovia': 'MZ',
    'opolskie': 'OP', 'opole': 'OP',
    'podkarpackie': 'PK', 'subcarpathian': 'PK', 'subcarpathia': 'PK',
    'podlaskie': 'PD', 'podlasie': 'PD',
    'pomorskie': 'PM', 'pomeranian': 'PM', 'pomerania': 'PM',
    'śląskie': 'SL', 'silesian': 'SL', 'silesia': 'SL', 'slaskie': 'SL',
    'świętokrzyskie': 'SK', 'holy cross': 'SK', 'swietokrzyskie': 'SK',
    'warmińsko-mazurskie': 'WN', 'warmian-masurian': 'WN', 'warminsko-mazurskie': 'WN',
    'wielkopolskie': 'WP', 'greater poland': 'WP',
    'zachodniopomorskie': 'ZP', 'west pomeranian': 'ZP', 'west pomerania': 'ZP'
};

// Japan prefecture name to code mapping (includes both English and Japanese romanized names)
const jpPrefectureNameToCode = {
    // Hokkaido
    'hokkaido': '01', 'hokkai do': '01',
    // Tohoku
    'aomori': '02', 'aomori ken': '02',
    'iwate': '03', 'iwate ken': '03',
    'miyagi': '04', 'miyagi ken': '04',
    'akita': '05', 'akita ken': '05',
    'yamagata': '06', 'yamagata ken': '06',
    'fukushima': '07', 'fukushima ken': '07',
    // Kanto
    'ibaraki': '08', 'ibaraki ken': '08',
    'tochigi': '09', 'tochigi ken': '09',
    'gunma': '10', 'gunma ken': '10', 'gumma': '10',
    'saitama': '11', 'saitama ken': '11',
    'chiba': '12', 'chiba ken': '12',
    'tokyo': '13', 'tokyo to': '13', 'tōkyō': '13',
    'kanagawa': '14', 'kanagawa ken': '14',
    // Chubu
    'niigata': '15', 'niigata ken': '15',
    'toyama': '16', 'toyama ken': '16',
    'ishikawa': '17', 'ishikawa ken': '17',
    'fukui': '18', 'fukui ken': '18',
    'yamanashi': '19', 'yamanashi ken': '19',
    'nagano': '20', 'nagano ken': '20',
    'gifu': '21', 'gifu ken': '21',
    'shizuoka': '22', 'shizuoka ken': '22',
    'aichi': '23', 'aichi ken': '23',
    // Kinki/Kansai
    'mie': '24', 'mie ken': '24',
    'shiga': '25', 'shiga ken': '25',
    'kyoto': '26', 'kyoto fu': '26', 'kyōto': '26',
    'osaka': '27', 'osaka fu': '27', 'ōsaka': '27',
    'hyogo': '28', 'hyogo ken': '28', 'hyōgo': '28',
    'nara': '29', 'nara ken': '29',
    'wakayama': '30', 'wakayama ken': '30',
    // Chugoku
    'tottori': '31', 'tottori ken': '31',
    'shimane': '32', 'shimane ken': '32',
    'okayama': '33', 'okayama ken': '33',
    'hiroshima': '34', 'hiroshima ken': '34',
    'yamaguchi': '35', 'yamaguchi ken': '35',
    // Shikoku
    'tokushima': '36', 'tokushima ken': '36',
    'kagawa': '37', 'kagawa ken': '37',
    'ehime': '38', 'ehime ken': '38',
    'kochi': '39', 'kochi ken': '39', 'kōchi': '39',
    // Kyushu & Okinawa
    'fukuoka': '40', 'fukuoka ken': '40',
    'saga': '41', 'saga ken': '41',
    'nagasaki': '42', 'nagasaki ken': '42',
    'kumamoto': '43', 'kumamoto ken': '43',
    'oita': '44', 'oita ken': '44', 'ōita': '44',
    'miyazaki': '45', 'miyazaki ken': '45',
    'kagoshima': '46', 'kagoshima ken': '46',
    'okinawa': '47', 'okinawa ken': '47'
};

// South Korea province/city name to code mapping
// All values must map to keys that exist in data.js
const krProvinceNameToCode = {
    // Special City
    'seoul': 'Seoul', 'seoul-teukbyeolsi': 'Seoul', 'seoul teukbyeolsi': 'Seoul',
    // Special Self-Governing City
    'sejong': 'Sejong', 'sejong-si': 'Sejong', 'sejong si': 'Sejong',
    // Metropolitan Cities
    'busan': 'Busan', 'busan-gwangyeoksi': 'Busan', 'pusan': 'Busan',
    'daegu': 'Daegu', 'daegu-gwangyeoksi': 'Daegu', 'taegu': 'Daegu',
    'incheon': 'Incheon', 'incheon-gwangyeoksi': 'Incheon', 'inchon': 'Incheon',
    'gwangju': 'Gwangju', 'gwangju-gwangyeoksi': 'Gwangju', 'kwangju': 'Gwangju',
    'daejeon': 'Daejeon', 'daejeon-gwangyeoksi': 'Daejeon', 'taejon': 'Daejeon',
    'ulsan': 'Ulsan', 'ulsan-gwangyeoksi': 'Ulsan',
    // Provinces - all map to the -do suffixed keys in data.js
    'gyeonggi': 'Gyeonggi-do', 'gyeonggi-do': 'Gyeonggi-do', 'gyeonggi do': 'Gyeonggi-do', 'kyonggi-do': 'Gyeonggi-do',
    'gangwon': 'Gangwon-do', 'gangwon-do': 'Gangwon-do', 'gangwon do': 'Gangwon-do', 'kangwon-do': 'Gangwon-do',
    'chungcheongbuk': 'Chungcheongbuk-do', 'chungcheongbuk-do': 'Chungcheongbuk-do', 'north chungcheong': 'Chungcheongbuk-do',
    'chungbuk': 'Chungcheongbuk-do', 'chungbuk-do': 'Chungcheongbuk-do',
    'chungcheongnam': 'Chungcheongnam-do', 'chungcheongnam-do': 'Chungcheongnam-do', 'south chungcheong': 'Chungcheongnam-do',
    'chungnam': 'Chungcheongnam-do', 'chungnam-do': 'Chungcheongnam-do',
    'jeollabuk': 'Jeollabuk-do', 'jeollabuk-do': 'Jeollabuk-do', 'north jeolla': 'Jeollabuk-do',
    'jeonbuk': 'Jeollabuk-do', 'jeonbuk-do': 'Jeollabuk-do',
    'jeollanam': 'Jeollanam-do', 'jeollanam-do': 'Jeollanam-do', 'south jeolla': 'Jeollanam-do',
    'jeonnam': 'Jeollanam-do', 'jeonnam-do': 'Jeollanam-do',
    'gyeongsangbuk': 'Gyeongsangbuk-do', 'gyeongsangbuk-do': 'Gyeongsangbuk-do', 'north gyeongsang': 'Gyeongsangbuk-do',
    'gyeongbuk': 'Gyeongsangbuk-do', 'gyeongbuk-do': 'Gyeongsangbuk-do',
    'gyeongsangnam': 'Gyeongsangnam-do', 'gyeongsangnam-do': 'Gyeongsangnam-do', 'south gyeongsang': 'Gyeongsangnam-do',
    'gyeongnam': 'Gyeongsangnam-do', 'gyeongnam-do': 'Gyeongsangnam-do',
    'jeju': 'Jeju-do', 'jeju-do': 'Jeju-do', 'jeju do': 'Jeju-do', 'cheju': 'Jeju-do', 'cheju-do': 'Jeju-do'
};

// German state name to code mapping (German and English names, various formats)
const deStateNameToCode = {
    // Baden-Württemberg
    'baden-württemberg': 'BW', 'baden-wuerttemberg': 'BW', 'baden württemberg': 'BW', 'bw': 'BW',
    // Bavaria
    'bayern': 'BY', 'bavaria': 'BY', 'freistaat bayern': 'BY', 'by': 'BY',
    // Berlin
    'berlin': 'BE', 'be': 'BE',
    // Brandenburg
    'brandenburg': 'BB', 'bb': 'BB',
    // Bremen
    'bremen': 'HB', 'freie hansestadt bremen': 'HB', 'hb': 'HB',
    // Hamburg
    'hamburg': 'HH', 'freie und hansestadt hamburg': 'HH', 'hh': 'HH',
    // Hesse
    'hessen': 'HE', 'hesse': 'HE', 'he': 'HE',
    // Mecklenburg-Vorpommern
    'mecklenburg-vorpommern': 'MV', 'mecklenburg vorpommern': 'MV', 'mecklenburg-western pomerania': 'MV', 'mv': 'MV',
    // Lower Saxony
    'niedersachsen': 'NI', 'lower saxony': 'NI', 'ni': 'NI',
    // North Rhine-Westphalia
    'nordrhein-westfalen': 'NW', 'north rhine-westphalia': 'NW', 'nordrhein westfalen': 'NW', 'nrw': 'NW', 'nw': 'NW',
    // Rhineland-Palatinate
    'rheinland-pfalz': 'RP', 'rhineland-palatinate': 'RP', 'rheinland pfalz': 'RP', 'rp': 'RP',
    // Saarland
    'saarland': 'SL', 'sl': 'SL',
    // Saxony
    'sachsen': 'SN', 'saxony': 'SN', 'freistaat sachsen': 'SN', 'sn': 'SN',
    // Saxony-Anhalt
    'sachsen-anhalt': 'ST', 'saxony-anhalt': 'ST', 'sachsen anhalt': 'ST', 'st': 'ST',
    // Schleswig-Holstein
    'schleswig-holstein': 'SH', 'schleswig holstein': 'SH', 'sh': 'SH',
    // Thuringia
    'thüringen': 'TH', 'thuringia': 'TH', 'thueringen': 'TH', 'freistaat thüringen': 'TH', 'th': 'TH'
};

// Russia federal subject name to code mapping (Cyrillic and English names)
const ruSubjectNameToCode = {
    // Republics
    'адыгея': 'AD', 'республика адыгея': 'AD', 'adygea': 'AD', 'republic of adygea': 'AD',
    'алтай': 'AL', 'республика алтай': 'AL', 'altai republic': 'AL', 'altai': 'AL',
    'башкортостан': 'BA', 'республика башкортостан': 'BA', 'bashkortostan': 'BA',
    'бурятия': 'BU', 'республика бурятия': 'BU', 'buryatia': 'BU',
    'чечня': 'CE', 'чеченская республика': 'CE', 'chechnya': 'CE', 'chechen republic': 'CE',
    'чувашия': 'CU', 'чувашская республика': 'CU', 'chuvashia': 'CU', 'chuvash republic': 'CU',
    'дагестан': 'DA', 'республика дагестан': 'DA', 'dagestan': 'DA',
    'ингушетия': 'IN', 'республика ингушетия': 'IN', 'ingushetia': 'IN',
    'кабардино-балкария': 'KB', 'кабардино-балкарская республика': 'KB', 'kabardino-balkaria': 'KB',
    'калмыкия': 'KL', 'республика калмыкия': 'KL', 'kalmykia': 'KL',
    'карачаево-черкесия': 'KC', 'карачаево-черкесская республика': 'KC', 'karachay-cherkessia': 'KC',
    'карелия': 'KR', 'республика карелия': 'KR', 'karelia': 'KR',
    'коми': 'KO', 'республика коми': 'KO', 'komi': 'KO',
    'марий эл': 'ME', 'республика марий эл': 'ME', 'mari el': 'ME',
    'мордовия': 'MO', 'республика мордовия': 'MO', 'mordovia': 'MO',
    'саха': 'SA', 'республика саха': 'SA', 'якутия': 'SA', 'саха (якутия)': 'SA', 'sakha': 'SA', 'yakutia': 'SA',
    'северная осетия': 'SE', 'республика северная осетия-алания': 'SE', 'северная осетия-алания': 'SE', 'north ossetia': 'SE', 'north ossetia-alania': 'SE',
    'татарстан': 'TA', 'республика татарстан': 'TA', 'tatarstan': 'TA',
    'тыва': 'TY', 'республика тыва': 'TY', 'тува': 'TY', 'tuva': 'TY', 'tyva': 'TY',
    'удмуртия': 'UD', 'удмуртская республика': 'UD', 'udmurtia': 'UD',
    'хакасия': 'KK', 'республика хакасия': 'KK', 'khakassia': 'KK',
    'крым': 'CR', 'республика крым': 'CR', 'crimea': 'CR',
    'донецкая': 'DNR', 'донецкая народная республика': 'DNR', 'donetsk': 'DNR',
    'луганская': 'LNR', 'луганская народная республика': 'LNR', 'luhansk': 'LNR', 'lugansk': 'LNR',
    // Krais
    'алтайский край': 'ALT', 'altai krai': 'ALT',
    'камчатский край': 'KAM', 'kamchatka krai': 'KAM', 'kamchatka': 'KAM',
    'хабаровский край': 'KHA', 'khabarovsk krai': 'KHA', 'khabarovsk': 'KHA',
    'краснодарский край': 'KDA', 'krasnodar krai': 'KDA', 'krasnodar': 'KDA',
    'красноярский край': 'KYA', 'krasnoyarsk krai': 'KYA', 'krasnoyarsk': 'KYA',
    'пермский край': 'PER', 'perm krai': 'PER', 'perm': 'PER',
    'приморский край': 'PRI', 'primorsky krai': 'PRI', 'primorye': 'PRI',
    'ставропольский край': 'STA', 'stavropol krai': 'STA', 'stavropol': 'STA',
    'забайкальский край': 'ZAB', 'zabaykalsky krai': 'ZAB', 'transbaikal': 'ZAB',
    // Oblasts
    'амурская область': 'AMU', 'amur oblast': 'AMU', 'amur': 'AMU',
    'архангельская область': 'ARK', 'arkhangelsk oblast': 'ARK', 'arkhangelsk': 'ARK',
    'астраханская область': 'AST', 'astrakhan oblast': 'AST', 'astrakhan': 'AST',
    'белгородская область': 'BEL', 'belgorod oblast': 'BEL', 'belgorod': 'BEL',
    'брянская область': 'BRY', 'bryansk oblast': 'BRY', 'bryansk': 'BRY',
    'челябинская область': 'CHE', 'chelyabinsk oblast': 'CHE', 'chelyabinsk': 'CHE',
    'иркутская область': 'IRK', 'irkutsk oblast': 'IRK', 'irkutsk': 'IRK',
    'ивановская область': 'IVA', 'ivanovo oblast': 'IVA', 'ivanovo': 'IVA',
    'калининградская область': 'KGD', 'kaliningrad oblast': 'KGD', 'kaliningrad': 'KGD',
    'калужская область': 'KLU', 'kaluga oblast': 'KLU', 'kaluga': 'KLU',
    'кемеровская область': 'KEM', 'kemerovo oblast': 'KEM', 'kemerovo': 'KEM', 'кузбасс': 'KEM', 'kuzbass': 'KEM',
    'кировская область': 'KIR', 'kirov oblast': 'KIR', 'kirov': 'KIR',
    'костромская область': 'KOS', 'kostroma oblast': 'KOS', 'kostroma': 'KOS',
    'курганская область': 'KGN', 'kurgan oblast': 'KGN', 'kurgan': 'KGN',
    'курская область': 'KRS', 'kursk oblast': 'KRS', 'kursk': 'KRS',
    'ленинградская область': 'LEN', 'leningrad oblast': 'LEN',
    'липецкая область': 'LIP', 'lipetsk oblast': 'LIP', 'lipetsk': 'LIP',
    'магаданская область': 'MAG', 'magadan oblast': 'MAG', 'magadan': 'MAG',
    'московская область': 'MOS', 'moscow oblast': 'MOS',
    'мурманская область': 'MUR', 'murmansk oblast': 'MUR', 'murmansk': 'MUR',
    'нижегородская область': 'NIZ', 'nizhny novgorod oblast': 'NIZ', 'nizhegorod': 'NIZ', 'nizhny novgorod': 'NIZ',
    'новгородская область': 'NGR', 'novgorod oblast': 'NGR', 'novgorod': 'NGR',
    'новосибирская область': 'NVS', 'novosibirsk oblast': 'NVS', 'novosibirsk': 'NVS',
    'омская область': 'OMS', 'omsk oblast': 'OMS', 'omsk': 'OMS',
    'оренбургская область': 'ORE', 'orenburg oblast': 'ORE', 'orenburg': 'ORE',
    'орловская область': 'ORL', 'oryol oblast': 'ORL', 'oryol': 'ORL', 'orel': 'ORL',
    'пензенская область': 'PNZ', 'penza oblast': 'PNZ', 'penza': 'PNZ',
    'псковская область': 'PSK', 'pskov oblast': 'PSK', 'pskov': 'PSK',
    'ростовская область': 'ROS', 'rostov oblast': 'ROS', 'rostov': 'ROS',
    'рязанская область': 'RYA', 'ryazan oblast': 'RYA', 'ryazan': 'RYA',
    'сахалинская область': 'SAK', 'sakhalin oblast': 'SAK', 'sakhalin': 'SAK',
    'самарская область': 'SAM', 'samara oblast': 'SAM', 'samara': 'SAM',
    'саратовская область': 'SAR', 'saratov oblast': 'SAR', 'saratov': 'SAR',
    'смоленская область': 'SMO', 'smolensk oblast': 'SMO', 'smolensk': 'SMO',
    'свердловская область': 'SVE', 'sverdlovsk oblast': 'SVE', 'sverdlovsk': 'SVE',
    'тамбовская область': 'TAM', 'tambov oblast': 'TAM', 'tambov': 'TAM',
    'томская область': 'TOM', 'tomsk oblast': 'TOM', 'tomsk': 'TOM',
    'тульская область': 'TUL', 'tula oblast': 'TUL', 'tula': 'TUL',
    'тверская область': 'TVE', 'tver oblast': 'TVE', 'tver': 'TVE',
    'тюменская область': 'TYU', 'tyumen oblast': 'TYU', 'tyumen': 'TYU',
    'ульяновская область': 'ULY', 'ulyanovsk oblast': 'ULY', 'ulyanovsk': 'ULY',
    'владимирская область': 'VLA', 'vladimir oblast': 'VLA', 'vladimir': 'VLA',
    'волгоградская область': 'VGG', 'volgograd oblast': 'VGG', 'volgograd': 'VGG',
    'вологодская область': 'VLG', 'vologda oblast': 'VLG', 'vologda': 'VLG',
    'воронежская область': 'VOR', 'voronezh oblast': 'VOR', 'voronezh': 'VOR',
    'ярославская область': 'YAR', 'yaroslavl oblast': 'YAR', 'yaroslavl': 'YAR',
    'запорожская область': 'ZPO', 'zaporizhzhia oblast': 'ZPO', 'zaporizhzhia': 'ZPO', 'zaporozhye': 'ZPO',
    'херсонская область': 'KHE', 'kherson oblast': 'KHE', 'kherson': 'KHE',
    // Federal Cities
    'москва': 'MOW', 'город москва': 'MOW', 'moscow': 'MOW',
    'санкт-петербург': 'SPE', 'город санкт-петербург': 'SPE', 'saint petersburg': 'SPE', 'st. petersburg': 'SPE', 'st petersburg': 'SPE',
    'севастополь': 'SEV', 'город севастополь': 'SEV', 'sevastopol': 'SEV',
    // Autonomous Oblast
    'еврейская автономная область': 'YEV', 'еврейская ао': 'YEV', 'jewish autonomous oblast': 'YEV', 'jewish ao': 'YEV',
    // Autonomous Okrugs
    'чукотский автономный округ': 'CHU', 'чукотка': 'CHU', 'chukotka': 'CHU', 'chukotka autonomous okrug': 'CHU',
    'ханты-мансийский автономный округ': 'KHM', 'ханты-мансийский ао': 'KHM', 'хмао': 'KHM', 'югра': 'KHM', 'khanty-mansi': 'KHM', 'khanty-mansiysk': 'KHM', 'yugra': 'KHM',
    'ненецкий автономный округ': 'NEN', 'ненецкий ао': 'NEN', 'nenets': 'NEN', 'nenets autonomous okrug': 'NEN',
    'ямало-ненецкий автономный округ': 'YAN', 'ямало-ненецкий ао': 'YAN', 'янао': 'YAN', 'yamalo-nenets': 'YAN', 'yamal-nenets': 'YAN'
};

// France region name to code mapping (post-2016 regions; gregoiredavid GeoJSON uses "nom")
const frRegionNameToCode = {
    'île-de-france': 'IDF', 'ile-de-france': 'IDF', 'ile de france': 'IDF',
    'bretagne': 'BRE', 'brittany': 'BRE',
    'basse-normandie': 'NOR', 'haute-normandie': 'NOR', 'normandie': 'NOR', 'normandy': 'NOR',
    'hauts-de-france': 'HDF', 'hauts de france': 'HDF', 'nord-pas-de-calais-picardie': 'HDF',
    'grand est': 'GES', 'alsace-champagne-ardenne-lorraine': 'GES',
    'centre-val de loire': 'CVL', 'centre-val de loire': 'CVL', 'centre': 'CVL',
    'pays de la loire': 'PDL', 'pays de la loire': 'PDL',
    'bourgogne-franche-comté': 'BFC', 'bourgogne-franche-comte': 'BFC',
    'languedoc-roussillon': 'OCC', 'midi-pyrénées': 'OCC', 'midi-pyrenees': 'OCC', 'occitanie': 'OCC',
    'aquitaine': 'NAQ', 'limousin': 'NAQ', 'poitou-charentes': 'NAQ', 'nouvelle-aquitaine': 'NAQ',
    'auvergne': 'ARA', 'rhône-alpes': 'ARA', 'rhone-alpes': 'ARA', 'auvergne-rhône-alpes': 'ARA',
    'provence-alpes-côte d\'azur': 'PAC', 'provence-alpes-cote d\'azur': 'PAC', 'paca': 'PAC',
    'corse': 'COR', 'corsica': 'COR'
};
// France INSEE region code to our code (gregoiredavid uses code "11", "24", etc.)
const frInseeCodeToRegionCode = {
    '11': 'IDF', '24': 'BRE', '27': 'NOR', '28': 'HDF', '32': 'GES', '44': 'PDL',
    '52': 'BFC', '53': 'NAQ', '75': 'OCC', '76': 'ARA', '84': 'PAC', '93': 'COR', '94': 'CVL'
};

// Brazil state name to code mapping (GeoJSON uses name + sigla)
const brStateNameToCode = {
    'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amapa': 'AP', 'amazonas': 'AM', 'bahia': 'BA',
    'ceará': 'CE', 'ceara': 'CE', 'distrito federal': 'DF', 'federal district': 'DF',
    'espírito santo': 'ES', 'espirito santo': 'ES', 'goiás': 'GO', 'goias': 'GO',
    'maranhão': 'MA', 'maranhao': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
    'minas gerais': 'MG', 'pará': 'PA', 'para': 'PA', 'paraíba': 'PB', 'paraiba': 'PB',
    'paraná': 'PR', 'parana': 'PR', 'pernambuco': 'PE', 'piauí': 'PI', 'piaui': 'PI',
    'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
    'rondônia': 'RO', 'rondonia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC',
    'são paulo': 'SP', 'sao paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO'
};

// Costa Rica province name to code mapping (ISO 3166-2:CR style: A, C, G, H, L, P, SJ)
const crProvinceNameToCode = {
    'alajuela': 'A', 'provincia alajuela': 'A',
    'cartago': 'C', 'provincia cartago': 'C',
    'guanacaste': 'G', 'provincia guanacaste': 'G',
    'heredia': 'H', 'provincia heredia': 'H',
    'limón': 'L', 'limon': 'L', 'provincia limón': 'L', 'provincia limon': 'L',
    'puntarenas': 'P', 'provincia puntarenas': 'P',
    'san josé': 'SJ', 'san jose': 'SJ', 'provincia san josé': 'SJ', 'provincia san jose': 'SJ'
};

// Bolivia department name to code mapping (ISO 3166-2 style: BEN, CHU, CBA, etc.)
const boDepartmentNameToCode = {
    'beni': 'BEN', 'chuquisaca': 'CHU', 'cochabamba': 'CBA', 'la paz': 'LPZ',
    'oruro': 'ORU', 'pando': 'PAN', 'potosí': 'POT', 'potosi': 'POT',
    'santa cruz': 'SCZ', 'tarija': 'TAR'
};

// Color palette for different continents
const continentColors = {
    'Africa': '#f59e0b',
    'Asia': '#ef4444',
    'Europe': '#3b82f6',
    'North America': '#22c55e',
    'South America': '#8b5cf6',
    'Oceania': '#06b6d4',
    'Antarctica': '#94a3b8'
};

// Style function for GeoJSON features
function getCountryStyle(feature) {
    const countryData = findCountryData(feature);
    const continent = countryData?.continent || 'Unknown';
    const color = continentColors[continent] || '#64748b';
    
    return {
        fillColor: color,
        weight: 1,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.6
    };
}

// Style for subregions
function getSubregionStyle(countryCode) {
    const countryData = countriesData[countryCode];
    const continent = countryData?.continent || 'Unknown';
    const baseColor = continentColors[continent] || '#64748b';
    
    return {
        fillColor: baseColor,
        weight: 1,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.5
    };
}

// Highlight style on hover
function getHighlightStyle() {
    return {
        weight: 3,
        color: '#1e293b',
        fillOpacity: 0.85
    };
}

// Find country data from feature properties
function findCountryData(feature) {
    const props = feature.properties;
    
    if (props.ISO_A3 && countryCodeMapping[props.ISO_A3]) {
        const code = countryCodeMapping[props.ISO_A3];
        if (countriesData[code]) {
            return { code, ...countriesData[code] };
        }
    }
    
    if (props.ISO_A2 && countriesData[props.ISO_A2]) {
        return { code: props.ISO_A2, ...countriesData[props.ISO_A2] };
    }
    
    const names = [props.ADMIN, props.name, props.NAME, props.NAME_LONG];
    for (const name of names) {
        if (name) {
            const found = getCountryByName(name);
            if (found) return found;
        }
    }
    
    return null;
}

// Find subregion code from feature properties
function findSubregionCode(feature, countryCode) {
    const props = feature.properties;
    
    // Try multiple property names (different GeoJSON sources use different names)
    const possibleNames = [
        props.name, props.NAME, props.Name, props.NAME_1, props.admin,
        props.state, props.STATE, props.province, props.PROVINCE,
        props.region, props.REGION, props.Bundesland, props.bundesland,
        props.GEN, props.gen, props.VARNAME_1, props.NAME_EN, props.name_en,
        props.NAME_DE, props.name_de, props.NUTS_NAME, props.nuts_name,
        props.LAND, props.land, props.STATE_NAME, props.state_name,
        // GADM style properties
        props.NL_NAME_1, props.ENGTYPE_1, props.TYPE_1, props.HASC_1,
        props.NAME_LOCAL, props.name_local,
        // Japan GeoJSON properties
        props.nam, props.nam_ja,
        // France GeoJSON (gregoiredavid uses "nom")
        props.nom,
        // geoBoundaries
        props.shapeName, props.shapename
    ].filter(n => n);
    
    // Also check for code properties directly
    const possibleCodes = [
        props.code, props.CODE, props.iso, props.ISO, props.AGS,
        props.NUTS_CODE, props.nuts_code, props.RS, props.SN_L,
        props.id, props.ID, // Japan GeoJSON uses numeric id (1-47)
        props.sigla, // Brazil states GeoJSON uses sigla (e.g. "AC", "AL")
        props.cod_ccaa, props.COD_CCAA, props.code_ccaa, // Spain autonomous communities
        props.shapeISO // geoBoundaries uses shapeISO (e.g. "CR-H", "CR-SJ" for Costa Rica)
    ].filter(n => n);
    
    let mapping = null;
    if (countryCode === 'US') mapping = usStateNameToCode;
    else if (countryCode === 'CA') mapping = caProvinceNameToCode;
    else if (countryCode === 'AU') mapping = auStateNameToCode;
    else if (countryCode === 'DE') mapping = deStateNameToCode;
    else if (countryCode === 'GB') mapping = gbCountryNameToCode;
    else if (countryCode === 'LK') mapping = lkProvinceNameToCode;
    else if (countryCode === 'CH') mapping = chCantonNameToCode;
    else if (countryCode === 'NL') mapping = nlProvinceNameToCode;
    else if (countryCode === 'BE') mapping = beRegionNameToCode;
    else if (countryCode === 'PL') mapping = plVoivodeshipNameToCode;
    else if (countryCode === 'JP') mapping = jpPrefectureNameToCode;
    else if (countryCode === 'KR') mapping = krProvinceNameToCode;
    else if (countryCode === 'RU') mapping = ruSubjectNameToCode;
    else if (countryCode === 'FR') mapping = frRegionNameToCode;
    else if (countryCode === 'BR') mapping = brStateNameToCode;
    else if (countryCode === 'BO') mapping = boDepartmentNameToCode;
    else if (countryCode === 'ES') mapping = esAutonomousCommunityNameToCode;
    else if (countryCode === 'CR') mapping = crProvinceNameToCode;
    
    if (!mapping) return null;
    
    // Try direct code match first (for German states, codes like 'BW', 'BY' might be in properties)
    const countryData = countriesData[countryCode];
    for (const code of possibleCodes) {
        let upperCode = code.toString().toUpperCase();
        // For Costa Rica, shapeISO is "CR-H", "CR-A", etc. - extract the part after "CR-"
        if (countryCode === 'CR' && upperCode.startsWith('CR-')) {
            upperCode = upperCode.slice(3);
        }
        // Check if this code exists in our data
        if (countryData?.subregions?.[upperCode]) {
            return upperCode;
        }
        // For Japan, IDs are numeric (1-47) but codes are zero-padded strings ("01"-"47")
        if (countryCode === 'JP' && !isNaN(code)) {
            const paddedCode = code.toString().padStart(2, '0');
            if (countryData?.subregions?.[paddedCode]) {
                return paddedCode;
            }
        }
    }
    
    // For South Korea, try direct NAME_1 match (GeoJSON uses same names as our data keys)
    if (countryCode === 'KR') {
        const countryData = countriesData[countryCode];
        if (props.NAME_1 && countryData?.subregions?.[props.NAME_1]) return props.NAME_1;
        if (props.NAME_1) {
            const withDo = props.NAME_1 + '-do';
            if (countryData?.subregions?.[withDo]) return withDo;
        }
        if (props.VARNAME_1) {
            const varNames = props.VARNAME_1.split('|');
            for (const varName of varNames) {
                const trimmed = varName.trim();
                if (countryData?.subregions?.[trimmed]) return trimmed;
                const trimmedWithDo = trimmed + '-do';
                if (countryData?.subregions?.[trimmedWithDo]) return trimmedWithDo;
            }
        }
    }
    
    // For France, try direct nom/code match (gregoiredavid GeoJSON uses "nom" and "code")
    if (countryCode === 'FR') {
        const countryData = countriesData[countryCode];
        if (props.nom && countryData?.subregions) {
            const nomLower = props.nom.toLowerCase().trim();
            const code = frRegionNameToCode[nomLower];
            if (code) return code;
        }
        if (props.code != null && countryData?.subregions) {
            const inseeKey = String(props.code);
            const frCodeByInsee = frInseeCodeToRegionCode[inseeKey];
            if (frCodeByInsee && countryData.subregions[frCodeByInsee]) return frCodeByInsee;
        }
    }
    
    // For Russia, try direct NAME match with Cyrillic names
    if (countryCode === 'RU') {
        const countryData = countriesData[countryCode];
        console.log('RU direct match: NAME =', props.NAME, 'code =', props.code, 'name =', props.name);
        
        // Try NAME property directly (Hubbitus GeoJSON uses Cyrillic names in NAME)
        if (props.NAME) {
            const nameLower = props.NAME.toLowerCase().trim();
            if (mapping[nameLower]) {
                console.log('RU NAME match found:', props.NAME, '->', mapping[nameLower]);
                return mapping[nameLower];
            }
        }
        
        // Try 'name' property (alt-dmitry GeoJSON uses lowercase 'name')
        if (props.name) {
            const nameLower = props.name.toLowerCase().trim();
            if (mapping[nameLower]) {
                console.log('RU name match found:', props.name, '->', mapping[nameLower]);
                return mapping[nameLower];
            }
        }
        
        // Try 'code' property (some GeoJSON sources use ISO 3166-2:RU codes)
        if (props.code) {
            const code = props.code.toString().toUpperCase();
            if (countryData?.subregions?.[code]) {
                console.log('RU code match found:', code);
                return code;
            }
        }
    }
    
    // Try each possible name
    console.log(`findSubregionCode for ${countryCode}: possibleNames =`, possibleNames);
    for (const rawName of possibleNames) {
        const name = rawName.toLowerCase().trim();
        console.log(`  Trying name: "${name}"`);
        
        // Direct match
        if (mapping[name]) {
            console.log(`  Direct match found: ${name} -> ${mapping[name]}`);
            return mapping[name];
        }
        
        // Try replacing special characters
        const normalizedName = name
            .replace(/ü/g, 'ue')
            .replace(/ö/g, 'oe')
            .replace(/ä/g, 'ae')
            .replace(/ß/g, 'ss')
            .replace(/-/g, ' ');
        if (mapping[normalizedName]) return mapping[normalizedName];
        
        // Try with hyphen replaced by space and vice versa
        const hyphenName = name.replace(/ /g, '-');
        const spaceName = name.replace(/-/g, ' ');
        if (mapping[hyphenName]) return mapping[hyphenName];
        if (mapping[spaceName]) return mapping[spaceName];
        
        // Try partial match
        for (const [key, code] of Object.entries(mapping)) {
            if (name.includes(key) || key.includes(name)) {
                return code;
            }
        }
    }
    
    return null;
}

// Helper function to find country by name
function getCountryByName(name) {
    if (!name) return null;
    
    const normalizedName = name.toLowerCase().trim();
    
    for (const [code, data] of Object.entries(countriesData)) {
        if (data.name.toLowerCase() === normalizedName) {
            return { code, ...data };
        }
    }
    
    const nameVariations = {
        'united states of america': 'US', 'united kingdom': 'GB', 'russian federation': 'RU',
        'republic of korea': 'KR', 'korea, republic of': 'KR', "democratic people's republic of korea": 'KP',
        'democratic republic of the congo': 'CD', 'republic of the congo': 'CG', 'congo': 'CG',
        "côte d'ivoire": 'CI', 'ivory coast': 'CI', 'czech republic': 'CZ', 'czechia': 'CZ',
        'viet nam': 'VN', 'iran, islamic republic of': 'IR', 'iran (islamic republic of)': 'IR',
        'syrian arab republic': 'SY', 'bolivia, plurinational state of': 'BO',
        'venezuela, bolivarian republic of': 'VE', 'tanzania, united republic of': 'TZ',
        "lao people's democratic republic": 'LA', 'brunei darussalam': 'BN', 'republic of moldova': 'MD',
        'north macedonia': 'MK', 'eswatini': 'SZ', 'swaziland': 'SZ', 'cabo verde': 'CV',
        'timor-leste': 'TL', 'east timor': 'TL'
    };
    
    const mappedCode = nameVariations[normalizedName];
    if (mappedCode && countriesData[mappedCode]) {
        return { code: mappedCode, ...countriesData[mappedCode] };
    }
    
    for (const [code, data] of Object.entries(countriesData)) {
        if (data.name.toLowerCase().includes(normalizedName) || 
            normalizedName.includes(data.name.toLowerCase())) {
            return { code, ...data };
        }
    }
    
    return null;
}

// Show flag tooltip (with optional subregion and sub-subregion/municipality)
function showFlagTooltip(countryData, x, y, subregionData = null, subSubregionData = null) {
    const tooltip = document.getElementById('flagTooltip');
    const flagImg = document.getElementById('tooltipFlag');
    const nameDiv = document.getElementById('tooltipName');
    const subregionDiv = document.getElementById('tooltipSubregion');
    const subregionFlagImg = document.getElementById('tooltipSubregionFlag');
    const subregionNameDiv = document.getElementById('tooltipSubregionName');
    const municipalityDiv = document.getElementById('tooltipMunicipality');
    const municipalityFlagImg = document.getElementById('tooltipMunicipalityFlag');
    const municipalityNameDiv = document.getElementById('tooltipMunicipalityName');
    
    flagImg.src = countryData.flag;
    flagImg.alt = countryData.name;
    nameDiv.textContent = countryData.name;
    
    // Show subregion if provided
    if (subregionData) {
        subregionFlagImg.src = subregionData.flag;
        subregionFlagImg.alt = subregionData.name;
        subregionNameDiv.textContent = subregionData.name;
        subregionDiv.style.display = 'block';
        
        // Style differently if it's a hint or fallback vs actual subregion
        if (subregionData.isHint || subregionData.isFallback) {
            subregionDiv.style.opacity = '0.7';
            subregionNameDiv.style.fontStyle = 'italic';
        } else {
            subregionDiv.style.opacity = '1';
            subregionNameDiv.style.fontStyle = 'normal';
        }
    } else {
        subregionDiv.style.display = 'none';
    }
    
    // Show municipality (third level) if provided
    if (subSubregionData) {
        municipalityFlagImg.src = subSubregionData.flag;
        municipalityFlagImg.alt = subSubregionData.name;
        municipalityNameDiv.textContent = subSubregionData.name;
        municipalityDiv.style.display = 'block';
        municipalityDiv.style.opacity = subSubregionData.isFallback ? '0.7' : '1';
    } else {
        municipalityDiv.style.display = 'none';
    }
    
    // Position tooltip
    tooltip.style.left = (x + 15) + 'px';
    tooltip.style.top = (y + 15) + 'px';
    tooltip.classList.add('visible');
    
    // Adjust if tooltip goes off screen
    setTimeout(() => {
        const rect = tooltip.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            tooltip.style.left = (x - rect.width - 15) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            tooltip.style.top = (y - rect.height - 15) + 'px';
        }
    }, 10);
}

// Hide flag tooltip
function hideFlagTooltip() {
    const tooltip = document.getElementById('flagTooltip');
    tooltip.classList.remove('visible');
}

// Load GeoJSON data
async function loadGeoJSON() {
    try {
        console.log('Loading GeoJSON...');
        const response = await fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson');
        const data = await response.json();
        
        console.log('GeoJSON loaded, features:', data.features.length);
        
        geoJsonLayer = L.geoJSON(data, {
            style: getCountryStyle,
            onEachFeature: onEachCountryFeature
        }).addTo(map);
        
        buildCountryBounds();
        updateSubregionLayersByViewport();
        console.log('GeoJSON layer added to map');
        
    } catch (error) {
        console.error('Error loading GeoJSON:', error);
        showFallbackMarkers();
    }
}

// Build map of country code -> LatLngBounds from main GeoJSON (for viewport checks)
function buildCountryBounds() {
    countryBounds = {};
    if (!geoJsonLayer) return;
    geoJsonLayer.eachLayer(function(layer) {
        const countryData = findCountryData(layer.feature);
        if (countryData?.code) {
            try {
                countryBounds[countryData.code] = layer.getBounds();
            } catch (err) {
                // ignore invalid geometry
            }
        }
    });
    console.log('Country bounds cached for', Object.keys(countryBounds).length, 'countries');
}

// Show subregion layers only for countries that are in the current viewport and zoom >= SUBREGION_MIN_ZOOM
function updateSubregionLayersByViewport() {
    currentZoom = map.getZoom();
    const bounds = map.getBounds();
    
    if (currentZoom < SUBREGION_MIN_ZOOM) {
        Object.keys(subregionLayers).forEach(function(countryCode) {
            if (map.hasLayer(subregionLayers[countryCode])) {
                map.removeLayer(subregionLayers[countryCode]);
            }
        });
        Object.keys(subSubregionLayers).forEach(function(countryCode) {
            if (map.hasLayer(subSubregionLayers[countryCode])) {
                map.removeLayer(subSubregionLayers[countryCode]);
            }
        });
        return;
    }
    
    Object.keys(subregionGeoJSONUrls).forEach(function(countryCode) {
        const hasSubregions = countriesData[countryCode]?.subregions;
        if (!hasSubregions) return;
        
        const boundsForCountry = countryBounds[countryCode];
        const inView = boundsForCountry && bounds.intersects(boundsForCountry);
        
        if (inView) {
            loadSubregionGeoJSON(countryCode);
            // Load sub-subregions (e.g. NL municipalities) when zoomed in enough
            if (currentZoom >= SUBSUBREGION_MIN_ZOOM && subSubregionGeoJSONUrls[countryCode]) {
                loadSubSubregionGeoJSON(countryCode);
            } else if (subSubregionLayers[countryCode] && map.hasLayer(subSubregionLayers[countryCode])) {
                map.removeLayer(subSubregionLayers[countryCode]);
            }
        } else {
            if (subregionLayers[countryCode] && map.hasLayer(subregionLayers[countryCode])) {
                map.removeLayer(subregionLayers[countryCode]);
            }
            if (subSubregionLayers[countryCode] && map.hasLayer(subSubregionLayers[countryCode])) {
                map.removeLayer(subSubregionLayers[countryCode]);
            }
        }
    });
}

// Load subregion GeoJSON for a specific country
async function loadSubregionGeoJSON(countryCode) {
    if (subregionLayers[countryCode]) {
        // Already loaded, just show it
        if (!map.hasLayer(subregionLayers[countryCode])) {
            subregionLayers[countryCode].addTo(map);
        }
        return;
    }
    
    const url = subregionGeoJSONUrls[countryCode];
    if (!url) {
        console.log(`No GeoJSON URL configured for ${countryCode}`);
        return;
    }
    
    try {
        console.log(`Loading subregions for ${countryCode} from ${url}...`);
        const response = await fetch(url);
        
        if (!response.ok) {
            console.warn(`GeoJSON not found for ${countryCode}: ${response.status}`);
            return;
        }
        
        const data = await response.json();
        
        // Check if data has features
        if (!data.features || data.features.length === 0) {
            console.warn(`No features in GeoJSON for ${countryCode}`);
            return;
        }
        
        console.log(`GeoJSON loaded for ${countryCode}, features:`, data.features.length);
        console.log('Sample feature properties:', data.features[0]?.properties);
        
        subregionLayers[countryCode] = L.geoJSON(data, {
            pane: 'subregions',
            style: () => getSubregionStyle(countryCode),
            onEachFeature: (feature, layer) => onEachSubregionFeature(feature, layer, countryCode)
        }).addTo(map);
        
        console.log(`Subregions layer added for ${countryCode}`);
        
    } catch (error) {
        console.error(`Error loading subregions for ${countryCode}:`, error);
    }
}

// Load sub-subregion GeoJSON (e.g. NL municipalities)
async function loadSubSubregionGeoJSON(countryCode) {
    if (subSubregionLayers[countryCode]) {
        if (!map.hasLayer(subSubregionLayers[countryCode])) {
            subSubregionLayers[countryCode].addTo(map);
        }
        return;
    }
    
    const url = subSubregionGeoJSONUrls[countryCode];
    if (!url) return;
    
    try {
        console.log(`Loading sub-subregions for ${countryCode} from ${url}...`);
        const response = await fetch(url);
        if (!response.ok) return;
        
        const data = await response.json();
        if (!data.features || data.features.length === 0) return;
        
        subSubregionLayers[countryCode] = L.geoJSON(data, {
            pane: 'subregions',
            style: () => getSubregionStyle(countryCode),
            onEachFeature: (feature, layer) => onEachSubSubregionFeature(feature, layer, countryCode)
        }).addTo(map);
        subSubregionLayers[countryCode].bringToFront();
    } catch (error) {
        console.error(`Error loading sub-subregions for ${countryCode}:`, error);
    }
}

// Feature interaction handlers for countries
function onEachCountryFeature(feature, layer) {
    layer.on({
        mouseover: highlightCountryFeature,
        mouseout: resetCountryHighlight,
        mousemove: updateTooltipPosition,
        click: onCountryClick
    });
}

// Feature interaction handlers for subregions
function onEachSubregionFeature(feature, layer, countryCode) {
    layer.on({
        mouseover: (e) => highlightSubregionFeature(e, countryCode),
        mouseout: (e) => resetSubregionHighlight(e, countryCode),
        mousemove: updateTooltipPosition,
        click: (e) => onSubregionClick(e, countryCode)
    });
}

// Feature interaction handlers for sub-subregions (e.g. NL municipalities)
function onEachSubSubregionFeature(feature, layer, countryCode) {
    layer.on({
        mouseover: (e) => highlightSubSubregionFeature(e, countryCode),
        mouseout: (e) => resetSubSubregionHighlight(e, countryCode),
        mousemove: updateTooltipPosition,
        click: (e) => L.DomEvent.stopPropagation(e)
    });
}

function highlightCountryFeature(e) {
    const layer = e.target;
    layer.setStyle(getHighlightStyle());
    layer.bringToFront();
    
    const countryData = findCountryData(layer.feature);
    
    if (countryData) {
        // Check if this country has subdivisions
        let subregionHint = null;
        if (countryData.subregions && Object.keys(countryData.subregions).length > 0) {
            // Get a sample subdivision to show
            const subregionKeys = Object.keys(countryData.subregions);
            const sampleSubregion = countryData.subregions[subregionKeys[0]];
            subregionHint = {
                name: `${countryData.subregionType || 'Subdivisions'} (zoom in to see)`,
                flag: sampleSubregion.flag,
                isHint: true
            };
        }
        showFlagTooltip(countryData, e.originalEvent.clientX, e.originalEvent.clientY, subregionHint);
    }
}

function highlightSubregionFeature(e, countryCode) {
    const layer = e.target;
    layer.setStyle(getHighlightStyle());
    layer.bringToFront();
    
    const countryData = countriesData[countryCode];
    if (!countryData) return;
    
    // Find subregion data
    const subregionCode = findSubregionCode(layer.feature, countryCode);
    let subregionData = null;
    
    const props = layer.feature.properties;
    
    if (subregionCode && countryData.subregions && countryData.subregions[subregionCode]) {
        subregionData = countryData.subregions[subregionCode];
    }
    
    // Get the subregion name from properties if we couldn't match a code
    if (!subregionData) {
        const name = props.name || props.NAME || props.Name || props.NAME_1 || 
                     props.province || props.PROVINCE || props.admin || 
                     props.Bundesland || props.state || 'Unknown';
        subregionData = { name: name + ' (flag not available)', flag: countryData.flag, isFallback: true };
    }
    
    showFlagTooltip(
        { code: countryCode, ...countryData },
        e.originalEvent.clientX,
        e.originalEvent.clientY,
        subregionData
    );
}

function highlightSubSubregionFeature(e, countryCode) {
    const layer = e.target;
    layer.setStyle(getHighlightStyle());
    layer.bringToFront();
    
    const countryData = countriesData[countryCode];
    if (!countryData || countryCode !== 'NL') return;
    
    const shapeName = layer.feature.properties?.shapeName || layer.feature.properties?.name;
    let municipalityData = shapeName && typeof nlMunicipalities !== 'undefined' && nlMunicipalities[shapeName];
    
    let subregionData = null;
    let subSubregionData = null;
    
    if (municipalityData) {
        subSubregionData = { name: municipalityData.name, flag: municipalityData.flag };
        const province = countryData.subregions?.[municipalityData.provinceCode];
        if (province) {
            subregionData = province;
        }
    }
    
    if (!subSubregionData) {
        subSubregionData = {
            name: shapeName || 'Unknown',
            flag: subregionData?.flag || countryData.flag,
            isFallback: true
        };
    }
    if (!subregionData) {
        subregionData = { name: 'Province', flag: countryData.flag, isFallback: true };
    }
    
    showFlagTooltip(
        { code: countryCode, ...countryData },
        e.originalEvent.clientX,
        e.originalEvent.clientY,
        subregionData,
        subSubregionData
    );
}

function resetSubSubregionHighlight(e, countryCode) {
    if (subSubregionLayers[countryCode]) {
        subSubregionLayers[countryCode].resetStyle(e.target);
    }
    hideFlagTooltip();
}

function updateTooltipPosition(e) {
    const tooltip = document.getElementById('flagTooltip');
    if (tooltip.classList.contains('visible')) {
        tooltip.style.left = (e.originalEvent.clientX + 15) + 'px';
        tooltip.style.top = (e.originalEvent.clientY + 15) + 'px';
        
        const rect = tooltip.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            tooltip.style.left = (e.originalEvent.clientX - rect.width - 15) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            tooltip.style.top = (e.originalEvent.clientY - rect.height - 15) + 'px';
        }
    }
}

function resetCountryHighlight(e) {
    if (geoJsonLayer) {
        geoJsonLayer.resetStyle(e.target);
    }
    hideFlagTooltip();
}

function resetSubregionHighlight(e, countryCode) {
    if (subregionLayers[countryCode]) {
        subregionLayers[countryCode].resetStyle(e.target);
    }
    hideFlagTooltip();
}

function onCountryClick(e) {
    const feature = e.target.feature;
    const countryData = findCountryData(feature);
    
    console.log('Clicked:', feature.properties.ADMIN || feature.properties.name);
    
    if (countryData) {
        selectedCountry = countryData;
        showCountrySidebar(countryData);
        
        map.fitBounds(e.target.getBounds(), {
            padding: [50, 50],
            maxZoom: 5
        });
        
        // Load subregion data if available
        if (countryData.subregions && subregionGeoJSONUrls[countryData.code]) {
            loadSubregionGeoJSON(countryData.code);
        }
    }
    
    hideFlagTooltip();
}

function onSubregionClick(e, countryCode) {
    const countryData = countriesData[countryCode];
    if (!countryData) return;
    
    const subregionCode = findSubregionCode(e.target.feature, countryCode);
    
    if (subregionCode && countryData.subregions && countryData.subregions[subregionCode]) {
        // Open sidebar with country and highlight subregion
        showCountrySidebar({ code: countryCode, ...countryData });
        
        // Auto-select the subregion
        setTimeout(() => {
            showSubregion(countryCode, subregionCode);
        }, 100);
    } else {
        showCountrySidebar({ code: countryCode, ...countryData });
    }
    
    hideFlagTooltip();
    L.DomEvent.stopPropagation(e);
}

// Handle zoom and pan: show subregions only for countries in the current view
function onMapViewChange() {
    updateSubregionLayersByViewport();
}
map.on('zoomend', onMapViewChange);
map.on('moveend', onMapViewChange);

// Fallback markers when GeoJSON fails
function showFallbackMarkers() {
    console.log('Using fallback markers');
    
    const coordinates = {
        'US': [39.8283, -98.5795], 'CA': [56.1304, -106.3468], 'MX': [23.6345, -102.5528],
        'BR': [-14.2350, -51.9253], 'AR': [-38.4161, -63.6167], 'GB': [55.3781, -3.4360],
        'FR': [46.2276, 2.2137], 'DE': [51.1657, 10.4515], 'IT': [41.8719, 12.5674],
        'ES': [40.4637, -3.7492], 'RU': [61.5240, 105.3188], 'CN': [35.8617, 104.1954],
        'JP': [36.2048, 138.2529], 'IN': [20.5937, 78.9629], 'AU': [-25.2744, 133.7751],
        'ZA': [-30.5595, 22.9375], 'EG': [26.8206, 30.8025], 'NG': [9.0820, 8.6753]
    };
    
    Object.entries(countriesData).forEach(([code, data]) => {
        const coords = coordinates[code];
        if (coords) {
            const marker = L.marker(coords, {
                icon: L.divIcon({
                    className: 'country-marker',
                    html: `<img src="${data.flag}" alt="${data.name}" style="width:30px;height:20px;border-radius:2px;box-shadow:0 1px 3px rgba(0,0,0,0.3);">`,
                    iconSize: [30, 20]
                })
            });
            
            marker.on('click', () => showCountrySidebar({ code, ...data }));
            marker.on('mouseover', (e) => showFlagTooltip({ code, ...data }, e.originalEvent.clientX, e.originalEvent.clientY));
            marker.on('mouseout', hideFlagTooltip);
            marker.addTo(map);
        }
    });
}

// Sidebar functionality
const sidebar = document.getElementById('sidebar');
const sidebarContent = document.getElementById('sidebarContent');
const closeSidebarBtn = document.getElementById('closeSidebar');

function showCountrySidebar(country) {
    console.log('Opening sidebar for:', country.name);
    sidebar.classList.add('open');
    
    const hasSubregions = country.subregions && Object.keys(country.subregions).length > 0;
    
    let html = `
        <div class="flag-container">
            <img src="${country.flag}" alt="${country.name} flag" class="flag-image" onerror="this.src='https://via.placeholder.com/320x200?text=Flag+Not+Available'">
            <h2 class="country-name">${country.name}</h2>
        </div>
        
        <div class="country-info">
            <div class="info-row">
                <span class="info-label">Capital</span>
                <span class="info-value">${country.capital || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Continent</span>
                <span class="info-value">${country.continent || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Country Code</span>
                <span class="info-value">${country.code || 'N/A'}</span>
            </div>
        </div>
    `;
    
    if (hasSubregions) {
        const hasGeoJSON = subregionGeoJSONUrls[country.code];
        const hintText = hasGeoJSON 
            ? `Zoom in on the map to see ${country.subregionType.toLowerCase()} boundaries`
            : `Click on a ${country.subregionType.toLowerCase().replace(/s$/, '')} below to see its flag`;
        
        html += `
            <div class="subregions-section">
                <h3>📍 ${country.subregionType}</h3>
                <p class="zoom-hint">${hintText}</p>
                <div class="subregions-grid">
        `;
        
        Object.entries(country.subregions).forEach(([code, region]) => {
            html += `
                <div class="subregion-card" data-code="${code}" data-country="${country.code}" 
                     onmouseenter="showSubregionTooltip(event, '${country.code}', '${code}')" 
                     onmouseleave="hideSubregionTooltip()"
                     onclick="showSubregion('${country.code}', '${code}')">
                    <img src="${region.flag}" alt="${region.name}" class="subregion-flag" onerror="this.src='https://via.placeholder.com/100x60?text=Flag'">
                    <div class="subregion-name" title="${region.name}">${region.name}</div>
                </div>
            `;
        });
        
        html += `
                </div>
                <div id="selectedSubregion"></div>
            </div>
        `;
    }
    
    sidebarContent.innerHTML = html;
    document.querySelector('.sidebar-header h2').textContent = country.name;
}

// Subregion tooltip
function showSubregionTooltip(event, countryCode, subregionCode) {
    const country = countriesData[countryCode];
    if (!country || !country.subregions) return;
    
    const subregion = country.subregions[subregionCode];
    if (!subregion) return;
    
    showFlagTooltip(
        { flag: country.flag, name: country.name },
        event.clientX,
        event.clientY,
        { flag: subregion.flag, name: subregion.name }
    );
}

function hideSubregionTooltip() {
    hideFlagTooltip();
}

function showSubregion(countryCode, subregionCode) {
    const country = countriesData[countryCode];
    const subregion = country.subregions[subregionCode];
    
    document.querySelectorAll('.subregion-card').forEach(card => card.classList.remove('active'));
    
    const activeCard = document.querySelector(`.subregion-card[data-code="${subregionCode}"]`);
    if (activeCard) activeCard.classList.add('active');
    
    const selectedDiv = document.getElementById('selectedSubregion');
    selectedDiv.innerHTML = `
        <div class="selected-subregion">
            <img src="${subregion.flag}" alt="${subregion.name}" class="flag-image" onerror="this.src='https://via.placeholder.com/200x120?text=Flag'">
            <h4>${subregion.name}</h4>
            <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">
                ${country.subregionType.replace(/s$/, '')} of ${country.name}
            </p>
        </div>
    `;
}

closeSidebarBtn.addEventListener('click', () => {
    sidebar.classList.remove('open');
    selectedCountry = null;
});

// Search functionality
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (query.length < 2) {
        searchResults.classList.remove('active');
        return;
    }
    
    const countries = getAllCountries();
    const matches = countries.filter(country => 
        country.name.toLowerCase().includes(query)
    ).slice(0, 10);
    
    if (matches.length === 0) {
        searchResults.classList.remove('active');
        return;
    }
    
    let html = '';
    matches.forEach(country => {
        html += `
            <div class="search-result-item" onclick="selectCountryFromSearch('${country.code}')">
                <img src="${country.flag}" alt="${country.name}" class="search-result-flag" onerror="this.style.display='none'">
                <span class="search-result-name">${country.name}</span>
            </div>
        `;
    });
    
    searchResults.innerHTML = html;
    searchResults.classList.add('active');
});

function selectCountryFromSearch(code) {
    const country = { code, ...countriesData[code] };
    showCountrySidebar(country);
    
    if (geoJsonLayer) {
        geoJsonLayer.eachLayer(layer => {
            const layerCode = countryCodeMapping[layer.feature.properties.ISO_A3];
            if (layerCode === code) {
                map.fitBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 5 });
                
                // Load subregions if available
                if (country.subregions && subregionGeoJSONUrls[code]) {
                    loadSubregionGeoJSON(code);
                }
            }
        });
    }
    
    searchInput.value = '';
    searchResults.classList.remove('active');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        searchResults.classList.remove('active');
    }
});

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        searchResults.classList.remove('active');
        searchInput.blur();
    }
});

window.addEventListener('resize', () => map.invalidateSize());

// Global functions
window.showSubregion = showSubregion;
window.selectCountryFromSearch = selectCountryFromSearch;
window.showSubregionTooltip = showSubregionTooltip;
window.hideSubregionTooltip = hideSubregionTooltip;

// Initialize
loadGeoJSON();

console.log('World Flags Explorer initialized!');
console.log('Countries loaded:', Object.keys(countriesData).length);
