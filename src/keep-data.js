
/* ============================================================
   DATA — sample tables modeled on well-known Kaggle datasets.
   Not fetched live: Kaggle requires auth and blocks browser CORS.
   ============================================================ */
const DB_SQL = `
CREATE TABLE employees (id INTEGER, name TEXT, department TEXT, salary INTEGER, years_exp INTEGER, city TEXT);
INSERT INTO employees VALUES
(1,'Amira Haddad','Data',82000,4,'Berlin'),(2,'Luca Ferrari','Data',96000,7,'Milan'),
(3,'Sara Novak','Data',61000,1,'Prague'),(4,'Tom Bakker','Engineering',105000,8,'Amsterdam'),
(5,'Yuki Tanaka','Engineering',88000,5,'Berlin'),(6,'Omar Bensalem','Engineering',72000,3,'Tunis'),
(7,'Elena Rossi','Sales',67000,6,'Milan'),(8,'James Okafor','Sales',54000,2,'London'),
(9,'Nina Petrov','Sales',91000,9,'Berlin'),(10,'Priya Nair','Marketing',59000,3,'London'),
(11,'Hugo Martin','Marketing',73000,5,'Paris'),(12,'Mei Chen','Data',118000,11,'Amsterdam'),
(13,'Karim Aziz','Engineering',64000,2,'Tunis'),(14,'Sofia Lindqvist','Sales',78000,4,'Stockholm'),
(15,'Daniel Weiss','Marketing',48000,1,'Berlin');

CREATE TABLE departments (id INTEGER, name TEXT, head_count_budget INTEGER, office TEXT);
INSERT INTO departments VALUES
(1,'Data',6,'Berlin'),(2,'Engineering',10,'Amsterdam'),(3,'Sales',8,'Milan'),
(4,'Marketing',5,'London'),(5,'Finance',4,'Paris');

CREATE TABLE orders (order_id INTEGER, customer TEXT, country TEXT, category TEXT, quantity INTEGER, unit_price REAL, order_date TEXT);
INSERT INTO orders VALUES
(1001,'Aurora Ltd','Germany','Hardware',3,249.00,'2024-01-14'),
(1002,'Beacon SA','France','Software',12,49.50,'2024-01-22'),
(1003,'Corvus BV','Netherlands','Hardware',1,1899.00,'2024-02-03'),
(1004,'Delta SRL','Italy','Services',5,320.00,'2024-02-11'),
(1005,'Aurora Ltd','Germany','Software',30,49.50,'2024-02-19'),
(1006,'Evron AB','Sweden','Hardware',2,749.00,'2024-03-02'),
(1007,'Beacon SA','France','Services',8,320.00,'2024-03-15'),
(1008,'Fjord AS','Norway','Software',6,49.50,'2024-03-21'),
(1009,'Corvus BV','Netherlands','Services',2,320.00,'2024-04-04'),
(1010,'Aurora Ltd','Germany','Hardware',7,249.00,'2024-04-18'),
(1011,'Gala SpA','Italy','Software',25,49.50,'2024-05-06'),
(1012,'Evron AB','Sweden','Services',3,320.00,'2024-05-27'),
(1013,'Fjord AS','Norway','Hardware',4,749.00,'2024-06-09'),
(1014,'Delta SRL','Italy','Hardware',1,1899.00,'2024-06-30'),
(1015,'Gala SpA','Italy','Services',11,320.00,'2024-07-12');
`;

/* Spreadsheet grid used by the Excel playground */
const SHEET = {
  headers:['Region','Rep','Category','Units','Price','Revenue'],
  rows:[
    ['North','Amira','Hardware',3,249,747],
    ['North','Luca','Software',12,49.5,594],
    ['South','Sara','Hardware',1,1899,1899],
    ['South','Tom','Services',5,320,1600],
    ['East','Yuki','Software',30,49.5,1485],
    ['East','Omar','Hardware',2,749,1498],
    ['West','Elena','Services',8,320,2560],
    ['West','James','Software',6,49.5,297],
    ['North','Nina','Services',2,320,640],
    ['South','Priya','Hardware',7,249,1743]
  ]
};

/* ── WHICH TRACKS SHIP ────────────────────────────────────────
   Edit this one line. Everything downstream — counts, the grid,
   the sidebar, the intro copy — is computed from it.
   Note: 'excel' genuinely executes (real formula evaluator, auto
   checked). 'r' and 'pbi' have no browser runtime and are written
   answers only. If interactivity is the criterion, the pair to
   drop is ['r','pbi'], not ['excel','pbi'].
   ────────────────────────────────────────────────────────────── */
const ENABLED = ['sql','python','r','git'];

/* The product name lives here so the wordmark, the document title and
   the tests all read the same string. Renaming is one line. */
const BRAND = 'AnalyzeIt';

/* `auto` means the track has a real runtime in the browser and grades
   answers against a computed result. It is declared per track rather
   than kept in a list elsewhere, because the list was the thing that
   went stale: every count and every honesty note in the interface is
   derived from this flag, so a new track cannot silently claim to be
   checked when it is not. */
const ALL_TRACKS = [
  {id:'sql',    name:'SQL',       color:'var(--s-sql)',    auto:true,  runtime:'SQLite compiled to WebAssembly',
   blurb:'Pulling the numbers out of the database',
   checked:'your query runs against real SQLite compiled to WebAssembly, and the result set is compared row by row against the solution\u2019s.'},
  {id:'python', name:'Python',    color:'var(--s-python)', auto:true,  runtime:'Pyodide with pandas',
   blurb:'Cleaning and reshaping with pandas',
   checked:'runs in Pyodide with pandas once loaded. Output is compared as text.'},
  {id:'excel',  name:'Excel',     color:'var(--s-excel)',  auto:true,  runtime:'a formula evaluator',
   blurb:'The tool every data job still runs on',
   checked:'formulas are parsed and evaluated against the live grid, then compared to the expected value.'},
  {id:'r',      name:'R',         color:'var(--s-r)',      auto:false, runtime:null,
   blurb:'Statistics and model output'},
  {id:'pbi',    name:'Power BI',  color:'var(--s-pbi)',    auto:false, runtime:null,
   blurb:'Turning a table into a decision'},
  {id:'git',    name:'Git',       color:'var(--s-git)',    auto:true,  runtime:'a commit-graph simulator',
   blurb:'Branching, merging and undoing safely',
   checked:'your commands run against a simulated repository, and the resulting history is compared by shape. Reaching the right history a different way still counts as correct.'}
];
const TRACKS = ALL_TRACKS.filter(t => ENABLED.includes(t.id));
const LEVELS = ['Beginner','Intermediate','Advanced'];
