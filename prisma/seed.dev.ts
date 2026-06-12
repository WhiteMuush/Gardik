import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@datashield.local"
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!"

async function main() {
  const company = await prisma.company.upsert({
    where: { domain: "datashield.dev" },
    update: {},
    create: { name: "DataShield Dev", domain: "datashield.dev" },
  })

  const hashedPassword = await bcrypt.hash(adminPassword, 12)
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, hashedPassword, role: "ADMIN", companyId: company.id },
  })

  // ─── BREACHES ──────────────────────────────────────────────────────────────
  const breachData = [
    { name: "LinkedIn 2016",      source: "HIBP",     date: "2016-05-18", types: ["email","password","username"],                          desc: "117M LinkedIn credentials leaked after a 2012 breach was fully exposed." },
    { name: "LinkedIn 2021",      source: "HIBP",     date: "2021-06-22", types: ["email","phone","address","geolocation","username"],      desc: "700M LinkedIn profiles scraped via the API and sold on dark web forums." },
    { name: "Adobe 2013",         source: "HIBP",     date: "2013-10-04", types: ["email","password","username"],                          desc: "153M Adobe accounts exposed including encrypted passwords." },
    { name: "Dropbox 2012",       source: "HIBP",     date: "2012-07-01", types: ["email","password"],                                     desc: "68M Dropbox user credentials stolen and later published in 2016." },
    { name: "Yahoo 2013",         source: "HIBP",     date: "2013-08-01", types: ["email","password","date_of_birth","phone","username"],   desc: "3 billion Yahoo accounts compromised — largest breach in history." },
    { name: "Yahoo 2014",         source: "HIBP",     date: "2014-01-01", types: ["email","password","phone","date_of_birth"],              desc: "500M Yahoo accounts breached by a state-sponsored actor." },
    { name: "MySpace 2013",       source: "HIBP",     date: "2013-06-11", types: ["email","password","username"],                          desc: "360M MySpace accounts exposed with poorly hashed passwords." },
    { name: "Facebook 2019",      source: "HIBP",     date: "2019-04-01", types: ["email","phone","date_of_birth","username","geolocation"],"desc": "533M Facebook records scraped including phone numbers and locations." },
    { name: "Twitter 2022",       source: "HIBP",     date: "2022-07-22", types: ["email","phone","username"],                             desc: "5.4M Twitter accounts exposed via an API vulnerability." },
    { name: "Canva 2019",         source: "HIBP",     date: "2019-05-24", types: ["email","username","date_of_birth","geolocation"],        desc: "139M Canva user accounts stolen including names and locations." },
    { name: "Twitch 2021",        source: "DARK_WEB", date: "2021-10-06", types: ["email","username","salary","contracts"],                desc: "Twitch source code and creator payout data leaked by anonymous hacker." },
    { name: "LastPass 2022",      source: "DARK_WEB", date: "2022-12-22", types: ["password","email","username","contracts"],              desc: "LastPass vault backups stolen including encrypted user passwords." },
    { name: "Uber 2016",          source: "HIBP",     date: "2016-10-01", types: ["email","phone","username","geolocation"],               desc: "57M Uber rider and driver records stolen and covered up for a year." },
    { name: "Equifax 2017",       source: "HIBP",     date: "2017-09-07", types: ["ssn","date_of_birth","address","credit_card"],          desc: "148M Americans' most sensitive financial data exposed by Equifax." },
    { name: "Marriott 2018",      source: "HIBP",     date: "2018-11-30", types: ["passport","date_of_birth","address","email","phone"],   desc: "500M Marriott/Starwood guests' data stolen over 4 years by Chinese hackers." },
    { name: "Capital One 2019",   source: "HIBP",     date: "2019-07-29", types: ["ssn","bank_account","credit_card","date_of_birth"],     desc: "106M credit card applications exposed via an AWS misconfiguration." },
    { name: "Collection 1 2019",  source: "DARK_WEB", date: "2019-01-17", types: ["email","password"],                                    desc: "773M unique emails and 21M passwords compiled from multiple breaches." },
    { name: "RockYou 2021",       source: "DARK_WEB", date: "2021-06-04", types: ["password","email"],                                    desc: "8.4B plaintext passwords compiled from years of leaks." },
    { name: "RockYou 2024",       source: "DARK_WEB", date: "2024-07-04", types: ["password","email"],                                    desc: "10B plaintext passwords — largest password compilation ever leaked." },
    { name: "Deezer 2022",        source: "HIBP",     date: "2022-11-01", types: ["email","username","date_of_birth","geolocation"],       desc: "240M Deezer users' data sold on a dark web forum." },
    { name: "Trello 2024",        source: "HIBP",     date: "2024-01-22", types: ["email","username"],                                    desc: "15M Trello users' profiles scraped via a public API endpoint." },
    { name: "Slack 2015",         source: "HIBP",     date: "2015-03-27", types: ["email","username","phone"],                            desc: "93M Slack user accounts exposed including hashed passwords." },
    { name: "Tumblr 2013",        source: "HIBP",     date: "2013-06-01", types: ["email","password"],                                    desc: "65M Tumblr accounts stolen and resurfaced for sale in 2016." },
    { name: "Dailymotion 2016",   source: "HIBP",     date: "2016-10-20", types: ["email","username","password"],                         desc: "85M Dailymotion accounts with hashed passwords exposed." },
    { name: "Gravatar 2020",      source: "HIBP",     date: "2020-10-03", types: ["email","username","geolocation"],                      desc: "167M Gravatar profiles scraped and published on a hacker forum." },
    { name: "Flipboard 2019",     source: "HIBP",     date: "2019-06-03", types: ["email","username","password"],                         desc: "145M Flipboard user accounts compromised over 9 months." },
    { name: "Free 2024",          source: "DARK_WEB", date: "2024-10-21", types: ["email","phone","address","bank_account","username"],    desc: "19M Free subscribers' data leaked including IBAN for 5M customers." },
    { name: "France Travail 2024",source: "DARK_WEB", date: "2024-02-13", types: ["ssn","date_of_birth","email","phone","address"],        desc: "43M Pôle Emploi / France Travail records exposed including NIR." },
    { name: "PayPal 2022",        source: "HIBP",     date: "2022-12-20", types: ["ssn","date_of_birth","address","tax_id"],               desc: "35K PayPal accounts accessed via credential stuffing attacks." },
    { name: "Disqus 2012",        source: "HIBP",     date: "2012-07-01", types: ["email","username","password"],                         desc: "17.5M Disqus accounts stolen and disclosed 5 years later in 2017." },
  ] as const

  const breaches = await Promise.all(
    breachData.map((b) =>
      prisma.breach.upsert({
        where: { name: b.name },
        update: {},
        create: {
          name: b.name,
          source: b.source as "HIBP" | "DARK_WEB" | "MANUAL",
          breachDate: new Date(b.date),
          description: b.desc,
          dataTypes: [...b.types],
        },
      })
    )
  )

  const bMap = Object.fromEntries(breaches.map((b) => [b.name, b]))

  // ─── EMPLOYEES ─────────────────────────────────────────────────────────────
  const employeeData = [
    { email: "alice.martin@datashield.dev",     firstName: "Alice",     lastName: "Martin",    department: "Engineering" },
    { email: "bob.dupont@datashield.dev",       firstName: "Bob",       lastName: "Dupont",    department: "Engineering" },
    { email: "claire.bernard@datashield.dev",   firstName: "Claire",    lastName: "Bernard",   department: "Marketing" },
    { email: "david.leroy@datashield.dev",      firstName: "David",     lastName: "Leroy",     department: "Sales" },
    { email: "emma.petit@datashield.dev",       firstName: "Emma",      lastName: "Petit",     department: "HR" },
    { email: "francois.moreau@datashield.dev",  firstName: "François",  lastName: "Moreau",    department: "Finance" },
    { email: "grace.simon@datashield.dev",      firstName: "Grace",     lastName: "Simon",     department: "Engineering" },
    { email: "hugo.laurent@datashield.dev",     firstName: "Hugo",      lastName: "Laurent",   department: "Sales" },
    { email: "isabelle.thomas@datashield.dev",  firstName: "Isabelle",  lastName: "Thomas",    department: "Legal" },
    { email: "julien.robert@datashield.dev",    firstName: "Julien",    lastName: "Robert",    department: "Product" },
    { email: "karine.richard@datashield.dev",   firstName: "Karine",    lastName: "Richard",   department: "Marketing" },
    { email: "luca.garcia@datashield.dev",      firstName: "Luca",      lastName: "Garcia",    department: "Engineering" },
    { email: "marie.andre@datashield.dev",      firstName: "Marie",     lastName: "André",     department: "HR" },
    { email: "nicolas.blanc@datashield.dev",    firstName: "Nicolas",   lastName: "Blanc",     department: "DevOps" },
    { email: "olivia.weber@datashield.dev",     firstName: "Olivia",    lastName: "Weber",     department: "Finance" },
    { email: "paul.henry@datashield.dev",       firstName: "Paul",      lastName: "Henry",     department: "Sales" },
    { email: "quentin.rousseau@datashield.dev", firstName: "Quentin",   lastName: "Rousseau",  department: "DevOps" },
    { email: "rachel.girard@datashield.dev",    firstName: "Rachel",    lastName: "Girard",    department: "Product" },
    { email: "samuel.roux@datashield.dev",      firstName: "Samuel",    lastName: "Roux",      department: "Engineering" },
    { email: "therese.vincent@datashield.dev",  firstName: "Thérèse",   lastName: "Vincent",   department: "Management" },
    { email: "ugo.lefebvre@datashield.dev",     firstName: "Ugo",       lastName: "Lefebvre",  department: "Support" },
    { email: "valerie.chevalier@datashield.dev",firstName: "Valérie",   lastName: "Chevalier", department: "Legal" },
    { email: "william.perrin@datashield.dev",   firstName: "William",   lastName: "Perrin",    department: "Management" },
    { email: "xavier.morel@datashield.dev",     firstName: "Xavier",    lastName: "Morel",     department: "DevOps" },
    { email: "yasmine.colin@datashield.dev",    firstName: "Yasmine",   lastName: "Colin",     department: "Marketing" },
  ]

  const employees = await Promise.all(
    employeeData.map((e) =>
      prisma.employee.upsert({
        where: { email_companyId: { email: e.email, companyId: company.id } },
        update: {},
        create: { ...e, companyId: company.id },
      })
    )
  )

  const eMap = Object.fromEntries(employees.map((e) => [e.email.split("@")[0], e]))

  // ─── BREACH RECORDS ────────────────────────────────────────────────────────
  const records = [
    // Alice — Engineering, très exposée (LinkedIn, Adobe, RockYou, Yahoo)
    { emp: "alice.martin",    breach: "LinkedIn 2021",      data: ["email","phone"],              date: "2024-01-15" },
    { emp: "alice.martin",    breach: "Adobe 2013",         data: ["email","password"],            date: "2024-02-03" },
    { emp: "alice.martin",    breach: "RockYou 2024",       data: ["password","email"],            date: "2024-08-12" },
    { emp: "alice.martin",    breach: "Yahoo 2013",         data: ["email","password"],            date: "2023-06-01" },

    // Bob — Engineering, RockYou + LastPass (très critique)
    { emp: "bob.dupont",      breach: "RockYou 2024",       data: ["password","email"],            date: "2024-07-10" },
    { emp: "bob.dupont",      breach: "LastPass 2022",      data: ["password","email"],            date: "2023-01-05" },
    { emp: "bob.dupont",      breach: "LinkedIn 2016",      data: ["email","password"],            date: "2023-03-18" },
    { emp: "bob.dupont",      breach: "Slack 2015",         data: ["email","username","phone"],    date: "2022-11-22" },

    // Claire — Marketing, Facebook + Canva + Deezer
    { emp: "claire.bernard",  breach: "Facebook 2019",      data: ["email","phone","geolocation"], date: "2024-03-20" },
    { emp: "claire.bernard",  breach: "Canva 2019",         data: ["email","username"],            date: "2023-07-14" },
    { emp: "claire.bernard",  breach: "Deezer 2022",        data: ["email","username"],            date: "2023-02-08" },
    { emp: "claire.bernard",  breach: "LinkedIn 2021",      data: ["email","address"],             date: "2024-05-02" },

    // David — Sales, Dropbox + Adobe + Equifax
    { emp: "david.leroy",     breach: "Dropbox 2012",       data: ["email","password"],            date: "2023-11-05" },
    { emp: "david.leroy",     breach: "Adobe 2013",         data: ["email","password","username"], date: "2024-01-28" },
    { emp: "david.leroy",     breach: "Equifax 2017",       data: ["ssn","date_of_birth"],         date: "2023-09-10" },

    // Emma — HR, France Travail + PayPal
    { emp: "emma.petit",      breach: "France Travail 2024",data: ["ssn","date_of_birth","email"], date: "2024-03-01" },
    { emp: "emma.petit",      breach: "PayPal 2022",        data: ["ssn","date_of_birth"],         date: "2023-02-14" },
    { emp: "emma.petit",      breach: "LinkedIn 2021",      data: ["email","phone"],               date: "2024-06-18" },

    // François — Finance, Equifax + Capital One + Marriott (très sensible)
    { emp: "francois.moreau", breach: "Equifax 2017",       data: ["ssn","date_of_birth","address","credit_card"], date: "2023-09-07" },
    { emp: "francois.moreau", breach: "Capital One 2019",   data: ["ssn","bank_account","credit_card"], date: "2023-10-15" },
    { emp: "francois.moreau", breach: "Marriott 2018",      data: ["passport","date_of_birth","address"], date: "2023-12-01" },

    // Grace — Engineering, Twitch + GitHub-adjacent + Collection 1
    { emp: "grace.simon",     breach: "Twitch 2021",        data: ["email","username","salary"],   date: "2024-01-08" },
    { emp: "grace.simon",     breach: "Collection 1 2019",  data: ["email","password"],            date: "2023-04-22" },
    { emp: "grace.simon",     breach: "LinkedIn 2016",      data: ["email","password"],            date: "2022-09-15" },

    // Hugo — Sales, Free + Uber
    { emp: "hugo.laurent",    breach: "Free 2024",          data: ["email","phone","address","bank_account"], date: "2024-11-01" },
    { emp: "hugo.laurent",    breach: "Uber 2016",          data: ["email","phone"],               date: "2023-05-30" },
    { emp: "hugo.laurent",    breach: "Facebook 2019",      data: ["email","phone"],               date: "2024-04-11" },

    // Isabelle — Legal, Marriott + Yahoo
    { emp: "isabelle.thomas", breach: "Marriott 2018",      data: ["passport","email","phone"],    date: "2023-11-20" },
    { emp: "isabelle.thomas", breach: "Yahoo 2014",         data: ["email","password"],            date: "2022-08-05" },

    // Julien — Product, Trello + Slack + Gravatar
    { emp: "julien.robert",   breach: "Trello 2024",        data: ["email","username"],            date: "2024-02-10" },
    { emp: "julien.robert",   breach: "Slack 2015",         data: ["email","username"],            date: "2022-12-03" },
    { emp: "julien.robert",   breach: "Gravatar 2020",      data: ["email","username"],            date: "2023-01-17" },

    // Karine — Marketing, Canva + Deezer + Dailymotion
    { emp: "karine.richard",  breach: "Canva 2019",         data: ["email","username","date_of_birth"], date: "2023-08-22" },
    { emp: "karine.richard",  breach: "Deezer 2022",        data: ["email","username"],            date: "2023-03-14" },
    { emp: "karine.richard",  breach: "Dailymotion 2016",   data: ["email","username","password"], date: "2022-07-09" },

    // Luca — Engineering, RockYou + Collection 1 + LastPass
    { emp: "luca.garcia",     breach: "RockYou 2021",       data: ["email","password"],            date: "2023-07-01" },
    { emp: "luca.garcia",     breach: "Collection 1 2019",  data: ["email","password"],            date: "2022-06-15" },
    { emp: "luca.garcia",     breach: "LastPass 2022",      data: ["password","email"],            date: "2023-02-20" },

    // Marie — HR, France Travail + LinkedIn
    { emp: "marie.andre",     breach: "France Travail 2024",data: ["ssn","date_of_birth","email","phone"], date: "2024-03-01" },
    { emp: "marie.andre",     breach: "LinkedIn 2021",      data: ["email","phone"],               date: "2024-07-22" },

    // Nicolas — DevOps, Twitter + Twitch + Slack
    { emp: "nicolas.blanc",   breach: "Twitter 2022",       data: ["email","phone","username"],    date: "2024-01-30" },
    { emp: "nicolas.blanc",   breach: "Twitch 2021",        data: ["email","username"],            date: "2023-10-06" },
    { emp: "nicolas.blanc",   breach: "Slack 2015",         data: ["email","phone"],               date: "2022-05-18" },

    // Olivia — Finance, Capital One + Equifax + Free
    { emp: "olivia.weber",    breach: "Capital One 2019",   data: ["credit_card","bank_account"],  date: "2024-02-05" },
    { emp: "olivia.weber",    breach: "Equifax 2017",       data: ["ssn","date_of_birth","address"], date: "2023-09-07" },
    { emp: "olivia.weber",    breach: "Free 2024",          data: ["email","phone","bank_account"], date: "2024-11-01" },

    // Paul — Sales, Facebook + Uber + Canva
    { emp: "paul.henry",      breach: "Facebook 2019",      data: ["email","phone","date_of_birth"], date: "2024-04-03" },
    { emp: "paul.henry",      breach: "Uber 2016",          data: ["email","phone","geolocation"], date: "2023-06-22" },
    { emp: "paul.henry",      breach: "Canva 2019",         data: ["email","username"],            date: "2023-09-01" },

    // Quentin — DevOps, LastPass + RockYou + LinkedIn (profil critique)
    { emp: "quentin.rousseau",breach: "LastPass 2022",      data: ["password","email","contracts"],"date": "2023-01-05" },
    { emp: "quentin.rousseau",breach: "RockYou 2024",       data: ["password","email"],            date: "2024-09-03" },
    { emp: "quentin.rousseau",breach: "LinkedIn 2016",      data: ["email","password"],            date: "2022-10-11" },

    // Rachel — Product, Trello + Gravatar + Flipboard
    { emp: "rachel.girard",   breach: "Trello 2024",        data: ["email","username"],            date: "2024-02-10" },
    { emp: "rachel.girard",   breach: "Gravatar 2020",      data: ["email","username"],            date: "2022-11-08" },
    { emp: "rachel.girard",   breach: "Flipboard 2019",     data: ["email","username","password"], date: "2023-04-17" },

    // Samuel — Engineering, Yahoo + MySpace + Tumblr
    { emp: "samuel.roux",     breach: "Yahoo 2013",         data: ["email","password","phone"],    date: "2022-03-12" },
    { emp: "samuel.roux",     breach: "MySpace 2013",       data: ["email","password","username"], date: "2022-04-05" },
    { emp: "samuel.roux",     breach: "Tumblr 2013",        data: ["email","password"],            date: "2022-05-20" },

    // Thérèse — Management, Marriott + Yahoo + LinkedIn
    { emp: "therese.vincent", breach: "Marriott 2018",      data: ["passport","email","address"],  date: "2023-11-30" },
    { emp: "therese.vincent", breach: "Yahoo 2014",         data: ["email","password","phone"],    date: "2022-07-01" },
    { emp: "therese.vincent", breach: "LinkedIn 2021",      data: ["email","phone"],               date: "2024-06-10" },

    // Ugo — Support, Disqus + Tumblr + MySpace
    { emp: "ugo.lefebvre",    breach: "Disqus 2012",        data: ["email","username","password"], date: "2022-02-14" },
    { emp: "ugo.lefebvre",    breach: "Tumblr 2013",        data: ["email","password"],            date: "2022-04-01" },
    { emp: "ugo.lefebvre",    breach: "MySpace 2013",       data: ["email","username"],            date: "2022-05-15" },

    // Valérie — Legal, Equifax + France Travail
    { emp: "valerie.chevalier",breach: "Equifax 2017",      data: ["ssn","date_of_birth","address"], date: "2023-09-07" },
    { emp: "valerie.chevalier",breach: "France Travail 2024",data: ["ssn","email","phone"],         date: "2024-03-01" },

    // William — Management, LinkedIn + Facebook + Marriott
    { emp: "william.perrin",  breach: "LinkedIn 2021",      data: ["email","phone","address"],     date: "2024-07-15" },
    { emp: "william.perrin",  breach: "Facebook 2019",      data: ["email","phone","date_of_birth"], date: "2024-04-22" },
    { emp: "william.perrin",  breach: "Marriott 2018",      data: ["passport","email"],            date: "2023-12-05" },

    // Xavier — DevOps, Collection 1 + RockYou + Twitter
    { emp: "xavier.morel",    breach: "Collection 1 2019",  data: ["email","password"],            date: "2022-09-10" },
    { emp: "xavier.morel",    breach: "RockYou 2021",       data: ["password","email"],            date: "2023-06-20" },
    { emp: "xavier.morel",    breach: "Twitter 2022",       data: ["email","phone"],               date: "2024-01-30" },

    // Yasmine — Marketing, Canva + Deezer + Free
    { emp: "yasmine.colin",   breach: "Canva 2019",         data: ["email","username","date_of_birth"], date: "2023-08-01" },
    { emp: "yasmine.colin",   breach: "Deezer 2022",        data: ["email","username"],            date: "2023-03-22" },
    { emp: "yasmine.colin",   breach: "Free 2024",          data: ["email","phone","address"],     date: "2024-11-01" },
  ]

  for (const r of records) {
    const employee = eMap[r.emp.replace("@datashield.dev", "")]
    const breach = bMap[r.breach]
    if (!employee || !breach) { console.warn(`Skipping: ${r.emp} / ${r.breach}`); continue }
    await prisma.breachRecord.upsert({
      where: { employeeId_breachId: { employeeId: employee.id, breachId: breach.id } },
      update: {},
      create: { employeeId: employee.id, breachId: breach.id, exposedData: r.data, detectedAt: new Date(r.date) },
    })
  }

  // ─── ALERTS ────────────────────────────────────────────────────────────────
  await prisma.alert.deleteMany({ where: { companyId: company.id } })
  await prisma.alert.createMany({
    data: [
      { companyId: company.id, employeeId: eMap["alice.martin"].id,    breachId: bMap["RockYou 2024"].id,       severity: "CRITICAL", status: "OPEN",         message: "Alice Martin's password found in RockYou 2024 — 10B plaintext passwords leak." },
      { companyId: company.id, employeeId: eMap["bob.dupont"].id,      breachId: bMap["LastPass 2022"].id,      severity: "CRITICAL", status: "OPEN",         message: "Bob Dupont's password vault backed up in LastPass 2022 breach." },
      { companyId: company.id, employeeId: eMap["quentin.rousseau"].id,breachId: bMap["LastPass 2022"].id,      severity: "CRITICAL", status: "OPEN",         message: "Quentin Rousseau's LastPass vault exposed — password rotation required immediately." },
      { companyId: company.id, employeeId: eMap["francois.moreau"].id, breachId: bMap["Capital One 2019"].id,   severity: "CRITICAL", status: "OPEN",         message: "François Moreau's credit card and bank account data exposed in Capital One breach." },
      { companyId: company.id, employeeId: eMap["olivia.weber"].id,    breachId: bMap["Capital One 2019"].id,   severity: "CRITICAL", status: "OPEN",         message: "Olivia Weber's financial data found in Capital One 2019 — card replacement advised." },
      { companyId: company.id, employeeId: eMap["emma.petit"].id,      breachId: bMap["France Travail 2024"].id,severity: "CRITICAL", status: "OPEN",         message: "Emma Petit's SSN and date of birth exposed in France Travail 2024 breach." },
      { companyId: company.id, employeeId: eMap["valerie.chevalier"].id,breachId: bMap["France Travail 2024"].id,severity: "CRITICAL", status: "ACKNOWLEDGED", message: "Valérie Chevalier's national ID data found in France Travail — identity theft risk." },
      { companyId: company.id, employeeId: eMap["hugo.laurent"].id,    breachId: bMap["Free 2024"].id,          severity: "HIGH",     status: "OPEN",         message: "Hugo Laurent's IBAN exposed in Free 2024 breach — bank fraud risk." },
      { companyId: company.id, employeeId: eMap["olivia.weber"].id,    breachId: bMap["Free 2024"].id,          severity: "HIGH",     status: "OPEN",         message: "Olivia Weber's phone and IBAN found in Free 2024 data leak." },
      { companyId: company.id, employeeId: eMap["alice.martin"].id,    breachId: bMap["Adobe 2013"].id,         severity: "HIGH",     status: "OPEN",         message: "Alice Martin's credentials found in Adobe 2013 — password change required." },
      { companyId: company.id, employeeId: eMap["david.leroy"].id,     breachId: bMap["Equifax 2017"].id,       severity: "HIGH",     status: "ACKNOWLEDGED", message: "David Leroy's SSN and date of birth exposed in Equifax 2017 breach." },
      { companyId: company.id, employeeId: eMap["francois.moreau"].id, breachId: bMap["Equifax 2017"].id,       severity: "HIGH",     status: "OPEN",         message: "François Moreau's credit and identity data in Equifax breach — monitor for fraud." },
      { companyId: company.id, employeeId: eMap["therese.vincent"].id, breachId: bMap["Marriott 2018"].id,      severity: "HIGH",     status: "OPEN",         message: "Thérèse Vincent's passport data found in Marriott 2018 breach." },
      { companyId: company.id, employeeId: eMap["william.perrin"].id,  breachId: bMap["Marriott 2018"].id,      severity: "HIGH",     status: "ACKNOWLEDGED", message: "William Perrin's passport exposed in Marriott — travel documents potentially compromised." },
      { companyId: company.id, employeeId: eMap["nicolas.blanc"].id,   breachId: bMap["Twitch 2021"].id,        severity: "HIGH",     status: "OPEN",         message: "Nicolas Blanc's Twitch credentials found in the 2021 source code leak." },
      { companyId: company.id, employeeId: eMap["luca.garcia"].id,     breachId: bMap["LastPass 2022"].id,      severity: "HIGH",     status: "OPEN",         message: "Luca Garcia's password manager data compromised in LastPass 2022 breach." },
      { companyId: company.id, employeeId: eMap["claire.bernard"].id,  breachId: bMap["Facebook 2019"].id,      severity: "MEDIUM",   status: "OPEN",         message: "Claire Bernard's phone number and location exposed in Facebook 2019 scrape." },
      { companyId: company.id, employeeId: eMap["bob.dupont"].id,      breachId: bMap["LinkedIn 2016"].id,      severity: "MEDIUM",   status: "ACKNOWLEDGED", message: "Bob Dupont's LinkedIn credentials from 2016 breach — likely stale but verify." },
      { companyId: company.id, employeeId: eMap["grace.simon"].id,     breachId: bMap["Twitch 2021"].id,        severity: "MEDIUM",   status: "OPEN",         message: "Grace Simon's email and salary data found in Twitch 2021 leak." },
      { companyId: company.id, employeeId: eMap["paul.henry"].id,      breachId: bMap["Facebook 2019"].id,      severity: "MEDIUM",   status: "OPEN",         message: "Paul Henry's Facebook profile data including DOB exposed in 2019 scrape." },
      { companyId: company.id, employeeId: eMap["isabelle.thomas"].id, breachId: bMap["Marriott 2018"].id,      severity: "MEDIUM",   status: "RESOLVED",     message: "Isabelle Thomas's passport data in Marriott breach — travel documents reviewed." },
      { companyId: company.id, employeeId: eMap["karine.richard"].id,  breachId: bMap["Canva 2019"].id,         severity: "MEDIUM",   status: "OPEN",         message: "Karine Richard's Canva account data exposed — password reset completed." },
      { companyId: company.id, employeeId: eMap["xavier.morel"].id,    breachId: bMap["Twitter 2022"].id,       severity: "LOW",      status: "OPEN",         message: "Xavier Morel's Twitter account data found in 2022 API breach." },
      { companyId: company.id, employeeId: eMap["rachel.girard"].id,   breachId: bMap["Trello 2024"].id,        severity: "LOW",      status: "RESOLVED",     message: "Rachel Girard's Trello profile scraped in January 2024 — email only, low risk." },
      { companyId: company.id, employeeId: eMap["samuel.roux"].id,     breachId: bMap["MySpace 2013"].id,       severity: "LOW",      status: "RESOLVED",     message: "Samuel Roux's old MySpace account found — passwords likely obsolete." },
      { companyId: company.id, employeeId: eMap["ugo.lefebvre"].id,    breachId: bMap["Disqus 2012"].id,        severity: "LOW",      status: "RESOLVED",     message: "Ugo Lefebvre's Disqus account from 2012 — very old, low immediate risk." },
    ],
  })

  console.log(`✓ Seed complete — ${breachData.length} breaches, ${employeeData.length} employees, ${records.length} breach records, 26 alerts`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
