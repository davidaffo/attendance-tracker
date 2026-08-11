import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const startYear = 2026
const endYear = startYear + 1
const generatedAt = `${endYear}-07-31T18:00:00.000Z`
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  `../resources/nextcloud-demo-${startYear}-${endYear}`
)

const statuses = [
  { id: 'present', code: 'P', label: 'Presente', color: '#2f7d68' },
  { id: 'absent', code: 'A', label: 'Assente', color: '#c94f46' },
  { id: 'late', code: 'R', label: 'Ritardo', color: '#d99835' },
  { id: 'volley', code: 'E', label: 'Impegno pallavolistico', color: '#4d70b7' },
  { id: 'injured', code: 'I', label: 'Infortunio', color: '#7f5aa2' }
]

const teams = [
  {
    id: 'under-12-blu',
    name: 'Under 12 Blu',
    coach: 'Giulia Neri',
    weekdays: [1, 3],
    athletes: [
      'Alice Bellini', 'Bianca Colombo', 'Caterina De Luca', 'Diletta Ferri',
      'Emma Gallo', 'Flavia Longo', 'Greta Mancini', 'Irene Marchetti',
      'Ludovica Moretti', 'Marta Pellegrini', 'Noemi Rinaldi', 'Sofia Villa'
    ]
  },
  {
    id: 'under-14-rossa',
    name: 'Under 14 Rossa',
    coach: 'Lorenzo Fontana',
    weekdays: [2, 4, 6],
    athletes: [
      'Arianna Barbieri', 'Beatrice Bernardi', 'Camilla Caruso', 'Carlotta Conti',
      'Elena D’Amico', 'Federica Esposito', 'Ginevra Fabbri', 'Giorgia Greco',
      'Isabella Lombardi', 'Matilde Monti', 'Nicole Romano', 'Rebecca Sala',
      'Sara Valentini', 'Vittoria Vitale'
    ]
  },
  {
    id: 'under-16-verde',
    name: 'Under 16 Verde',
    coach: 'Chiara Santoro',
    weekdays: [1, 3, 5],
    athletes: [
      'Alessia Amato', 'Aurora Basile', 'Claudia Bianchi', 'Eleonora Bruno',
      'Francesca Caputo', 'Gaia Cattaneo', 'Ilaria Costa', 'Laura Farina',
      'Maddalena Fiore', 'Margherita Giordano', 'Nina Marino', 'Olivia Parisi',
      'Rachele Ricci', 'Silvia Serra', 'Viola Testa'
    ],
    joinedLateIndex: 13
  },
  {
    id: 'under-18-gialla',
    name: 'Under 18 Gialla',
    coach: 'Andrea Messina',
    weekdays: [2, 4, 5],
    athletes: [
      'Adele Bassi', 'Asia Coppola', 'Benedetta Donati', 'Cecilia Gentile',
      'Cristina Leoni', 'Elisa Martini', 'Erica Milani', 'Giada Orlando',
      'Letizia Piras', 'Miriam Rizzi', 'Nadia Rossetti', 'Paola Sanna',
      'Serena Silvestri', 'Tea Valentini', 'Valeria Zanetti', 'Zoe Zorzi'
    ],
    archivedIndex: 15
  },
  {
    id: 'serie-d-aurora',
    name: 'Serie D Aurora',
    coach: 'Matteo De Angelis',
    weekdays: [1, 2, 4, 5],
    athletes: [
      'Agata Borrelli', 'Ambra Casale', 'Cinzia D’Onofrio', 'Debora Grassi',
      'Elettra Lanza', 'Fabiola Negri', 'Gemma Palmieri', 'Lucia Pozzi',
      'Monica Riva', 'Ofelia Russo', 'Patrizia Sartori', 'Roberta Tonelli',
      'Simona Valli', 'Teresa Volpi'
    ],
    archivedIndex: 12,
    joinedLateIndex: 13
  }
]

function uuidFor(value) {
  const hex = createHash('sha256').update(value).digest('hex').slice(0, 32).split('')
  hex[12] = '4'
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4]
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`
}

function scoreFor(value) {
  return Number.parseInt(createHash('sha256').update(value).digest('hex').slice(0, 8), 16)
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function isSeasonBreak(date) {
  const value = isoDate(date)
  return (
    (value >= '2026-12-24' && value <= '2027-01-06') ||
    (value >= '2027-04-02' && value <= '2027-04-05')
  )
}

function trainingDates(weekdays) {
  const dates = []
  for (
    let date = new Date(`${startYear}-08-17T12:00:00.000Z`);
    date <= new Date(`${endYear}-07-16T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    if (weekdays.includes(date.getUTCDay()) && !isSeasonBreak(date)) {
      dates.push(isoDate(date))
    }
  }
  return dates
}

function attendanceFor(teamId, athleteId, date) {
  const score = scoreFor(`${teamId}:${athleteId}:${date}`) % 100
  if (score < 82) return 'present'
  if (score < 89) return 'absent'
  if (score < 94) return 'late'
  if (score < 98) return 'volley'
  return 'injured'
}

function createDocument(team) {
  const createdAt = `${startYear}-08-01T09:00:00.000Z`
  const athletes = team.athletes.map((name, order) => {
    const joinedLate = order === team.joinedLateIndex
    const archived = order === team.archivedIndex
    return {
      id: uuidFor(`${team.id}:athlete:${order}`),
      name,
      order,
      active: !archived,
      createdAt: joinedLate ? `${startYear}-11-02T18:00:00.000Z` : createdAt,
      ...(archived ? { archivedAt: `${endYear}-03-01T18:00:00.000Z` } : {})
    }
  })

  const dates = trainingDates(team.weekdays)
  const sessions = dates.map((date, sessionIndex) => {
    const attendances = {}
    for (const [athleteIndex, athlete] of athletes.entries()) {
      if (athleteIndex === team.joinedLateIndex && date < `${startYear}-11-02`) continue
      if (athleteIndex === team.archivedIndex && date >= `${endYear}-03-01`) continue

      // L'ultima seduta resta volutamente incompleta per provare gli indicatori.
      if (
        sessionIndex === dates.length - 1 &&
        scoreFor(`${team.id}:incomplete:${athlete.id}`) % 4 === 0
      ) continue

      attendances[athlete.id] = attendanceFor(team.id, athlete.id, date)
    }

    const timestamp = `${date}T20:30:00.000Z`
    return {
      id: uuidFor(`${team.id}:session:${date}`),
      date,
      attendances,
      createdAt: timestamp,
      updatedAt: timestamp,
      updatedBy: team.coach
    }
  })

  return {
    schemaVersion: 1,
    teamId: team.id,
    teamName: team.name,
    organizationName: 'ASD Aurora Volley',
    coachName: team.coach,
    season: { startYear, endYear },
    revision: sessions.length + 4,
    updatedAt: generatedAt,
    updatedBy: team.coach,
    statuses,
    trainingWeekdays: team.weekdays,
    athletes,
    sessions
  }
}

await mkdir(root, { recursive: true })
for (const team of teams) {
  const document = createDocument(team)
  const fileName = `${team.id}__${startYear}-${endYear}.attendance.json`
  await writeFile(path.join(root, fileName), `${JSON.stringify(document, null, 2)}\n`)
}

const readme = `# Dataset coordinatore ${startYear}–${endYear}

Questa cartella simula la cartella \`attendance-tracker\` sincronizzata da Nextcloud.
Contiene ${teams.length} squadre e dati interamente sintetici, generati da
\`npm run generate:demo\`. I nomi non identificano persone reali.

Per provarla: aprire la modalità **Coordinatore**, scegliere **Cartella locale**
e selezionare questa directory. Ogni squadra ha sedute in tutti i dodici mesi;
sono presenti anche un ingresso tardivo, due archiviazioni con storico e una
seduta finale parzialmente compilata.
`
await writeFile(path.join(root, 'README.md'), readme)

console.log(`Generati ${teams.length} registri in ${root}`)
