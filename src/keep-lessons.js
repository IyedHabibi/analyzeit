
/* ============================================================
   CURRICULUM — 15 lessons. Each has a job scenario, a concept,
   a worked example, and an exercise that is machine-checked
   where the runtime allows it.
   ============================================================ */
const LESSONS = {
'sql-0':{
  title:'Reading rows with SELECT and WHERE',
  scenario:'Your manager forwards a Slack message: <b>"Can you send me everyone in the Data team earning over 80k? Need it before the 2pm call."</b> This is the single most common request a junior analyst gets.',
  concept:`<p>Every SQL query answers two questions: <em>which columns</em> and <em>which rows</em>. <code>SELECT</code> picks columns, <code>WHERE</code> filters rows.</p>
<ul><li><code>SELECT *</code> means every column. Fine while exploring, bad in a report — nobody wants 40 columns.</li>
<li><code>WHERE</code> runs once per row and keeps the rows where the condition is true.</li>
<li>Text goes in single quotes: <code>'Data'</code>. Numbers don't: <code>80000</code>.</li>
<li><code>ORDER BY ... DESC</code> sorts highest first. <code>LIMIT</code> caps the rows returned.</li></ul>
<p>A trap worth learning now: <code>WHERE salary > 80000</code> excludes exactly 80,000. If the ask was "80k and above", you need <code>&gt;=</code>. Reports get sent back over this.</p>`,
  example:"SELECT name, department, salary\nFROM employees\nWHERE department = 'Data'\nORDER BY salary DESC;",
  task:'Return <code>name</code> and <code>salary</code> for everyone in the Data department earning more than 80000, highest salary first.',
  solution:"SELECT name, salary FROM employees WHERE department='Data' AND salary > 80000 ORDER BY salary DESC;",
  hint:'You need three pieces: a WHERE with two conditions joined by AND, and an ORDER BY ... DESC.'
},
'sql-1':{
  title:'Joins and group-level aggregation',
  scenario:'Finance is planning next year\'s headcount. They want one row per department: how many people are in it, what the average salary is, and whether it is under its budgeted headcount. <b>Departments with nobody in them must still appear</b> — that is the whole point of the exercise.',
  concept:`<p>Two ideas stack here, and the order matters.</p>
<p><b>Joins</b> match rows across tables. <code>INNER JOIN</code> keeps only rows that match on both sides. <code>LEFT JOIN</code> keeps every row from the left table and fills in <code>NULL</code> where the right side has no match. Finance asked for empty departments, so <code>LEFT JOIN</code> is not a stylistic choice — it is the requirement.</p>
<p><b>Aggregation</b> collapses many rows into one. <code>GROUP BY d.name</code> makes one output row per department; <code>COUNT()</code>, <code>AVG()</code>, <code>SUM()</code> then summarise each group.</p>
<p>The classic bug: <code>COUNT(*)</code> counts rows, and a department with no employees still produces one row full of NULLs — so it returns 1, not 0. <code>COUNT(e.id)</code> counts non-null values and correctly returns 0. Interviewers ask this.</p>`,
  example:"SELECT d.name AS department,\n       COUNT(e.id) AS headcount,\n       ROUND(AVG(e.salary), 0) AS avg_salary\nFROM departments d\nLEFT JOIN employees e ON e.department = d.name\nGROUP BY d.name\nORDER BY headcount DESC;",
  task:'One row per department with <code>name</code>, a <code>headcount</code> that is 0 for empty departments, and the <code>head_count_budget</code>. Sort by headcount, highest first.',
  solution:"SELECT d.name, COUNT(e.id) AS headcount, d.head_count_budget FROM departments d LEFT JOIN employees e ON e.department=d.name GROUP BY d.name, d.head_count_budget ORDER BY headcount DESC;",
  hint:'Finance is the empty department — if it is missing you used INNER JOIN; if it shows 1 you used COUNT(*).'
},
'sql-2':{
  title:'Window functions and CTEs',
  scenario:'The compensation review needs each employee ranked <b>within their own department</b>, plus how far each sits from their department average. One query, no manual per-department passes.',
  concept:`<p><code>GROUP BY</code> destroys detail — you get one row per group. Window functions keep every row and add a column computed over a group.</p>
<ul><li><code>OVER (PARTITION BY department ORDER BY salary DESC)</code> restarts the calculation for each department.</li>
<li><code>ROW_NUMBER()</code> always gives 1,2,3 with no ties. <code>RANK()</code> gives 1,2,2,4. <code>DENSE_RANK()</code> gives 1,2,2,3. Pick deliberately — for "top 3 per group" the choice changes your row count.</li>
<li><code>AVG(salary) OVER (PARTITION BY department)</code> puts the department average on every row of that department.</li></ul>
<p><b>CTEs</b> (<code>WITH name AS (...)</code>) name an intermediate result. They exist because you cannot filter on a window function in <code>WHERE</code> — the window runs after <code>WHERE</code>. So you compute in a CTE and filter in the outer query.</p>`,
  example:"WITH ranked AS (\n  SELECT name, department, salary,\n         RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS r\n  FROM employees\n)\nSELECT * FROM ranked WHERE r <= 2 ORDER BY department, r;",
  task:'Return the <b>single highest paid person per department</b> — columns <code>name</code>, <code>department</code>, <code>salary</code> — sorted by department name.',
  solution:"WITH r AS (SELECT name, department, salary, ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC) AS rn FROM employees) SELECT name, department, salary FROM r WHERE rn=1 ORDER BY department;",
  hint:'Rank inside a CTE, then filter to rank 1 in the outer SELECT. Four departments have staff, so expect 4 rows.'
},

'python-0':{
  title:'Loading a file and looking before you leap',
  scenario:'A CSV lands in your inbox with no documentation. <b>Before you compute anything, you have to know what you are holding</b> — how many rows, what types, what is missing. Skipping this is how wrong numbers reach a slide deck.',
  concept:`<p>pandas gives you a <code>DataFrame</code>: a table with labelled columns and typed values.</p>
<ul><li><code>df.shape</code> → (rows, columns). Your first sanity check: does the row count match what you were told?</li>
<li><code>df.dtypes</code> → types. A price column typed <code>object</code> means text got in — a currency symbol, a stray comma — and every sum you write will be wrong or will crash.</li>
<li><code>df.head()</code> → first rows. <code>df.describe()</code> → count, mean, min, max per numeric column.</li>
<li><code>df.isna().sum()</code> → missing values per column. Do this before any average.</li></ul>
<p>The habit to build: never aggregate a column you have not inspected.</p>`,
  example:"import pandas as pd\n\ndf = pd.DataFrame({\n    'rep': ['Amira','Luca','Sara','Tom'],\n    'region': ['North','North','South','South'],\n    'revenue': [747, 594, 1899, 1600]\n})\n\nprint(df.shape)\nprint(df.dtypes)\nprint(df['revenue'].describe())",
  task:'Using the same <code>df</code>, print the total revenue and the number of unique regions — in that order, one per line.',
  solution:"import pandas as pd\ndf = pd.DataFrame({'rep':['Amira','Luca','Sara','Tom'],'region':['North','North','South','South'],'revenue':[747,594,1899,1600]})\nprint(df['revenue'].sum())\nprint(df['region'].nunique())",
  expect:"4840\n2",
  hint:'.sum() on the column, then .nunique() on the region column.'
},
'python-1':{
  title:'Cleaning what arrives broken',
  scenario:'The export you were sent has missing prices, duplicated order rows, and a revenue column that does not exist yet. <b>This is what most of the job actually is.</b> Analysts routinely spend more time here than on the analysis.',
  concept:`<p>Three moves cover most cleaning work.</p>
<ul><li><b>Missing values.</b> <code>df.dropna()</code> deletes rows. <code>df['x'].fillna(value)</code> replaces them. Deleting is not neutral — if prices are missing more often for one region, dropping them biases your regional totals. Say out loud which you chose and why.</li>
<li><b>Duplicates.</b> <code>df.drop_duplicates(subset=['order_id'])</code> beats a bare <code>drop_duplicates()</code>, which only removes rows identical in every column.</li>
<li><b>Derived columns.</b> <code>df['revenue'] = df['units'] * df['price']</code> works element-wise across the whole column at once. Writing a Python loop here is slower and marks you as new.</li></ul>`,
  example:"import pandas as pd\nimport numpy as np\n\ndf = pd.DataFrame({\n    'order_id':[1,2,2,3,4],\n    'units':[3,12,12,1,5],\n    'price':[249.0, 49.5, 49.5, np.nan, 320.0]\n})\n\ndf = df.drop_duplicates(subset=['order_id'])\ndf['price'] = df['price'].fillna(df['price'].median())\ndf['revenue'] = df['units'] * df['price']\nprint(df)",
  task:'From that cleaned frame, print the total revenue rounded to 2 decimals.',
  solution:"import pandas as pd, numpy as np\ndf = pd.DataFrame({'order_id':[1,2,2,3,4],'units':[3,12,12,1,5],'price':[249.0,49.5,49.5,np.nan,320.0]})\ndf = df.drop_duplicates(subset=['order_id'])\ndf['price'] = df['price'].fillna(df['price'].median())\ndf['revenue'] = df['units'] * df['price']\nprint(round(df['revenue'].sum(), 2))",
  expect:"3190.0",
  hint:'Deduplicate first, then fill, then multiply. Filling before deduplicating changes the median from 249.0 to 149.25, and the total with it.'
},
'python-2':{
  title:'groupby, and the shape your stakeholder wants',
  scenario:'"Revenue by region and category, and flag anything below 500." You have the rows. <b>The work is choosing the shape</b> — long for charting, wide for a table someone will read.',
  concept:`<p><code>groupby</code> splits rows into groups, applies a function, and combines the results.</p>
<ul><li><code>df.groupby('region')['revenue'].sum()</code> → one number per region.</li>
<li><code>.agg({'revenue':'sum','units':'mean'})</code> → different functions per column in one pass.</li>
<li>Grouping by two keys gives a MultiIndex. <code>.reset_index()</code> flattens it back to plain columns — do this before writing to CSV or charting, or the index will surprise you.</li>
<li><code>.pivot_table(index=..., columns=..., values=..., aggfunc='sum')</code> gives the wide cross-tab that non-technical readers expect.</li></ul>
<p>Long format for tools. Wide format for humans. Know which you are producing and for whom.</p>`,
  example:"import pandas as pd\n\ndf = pd.DataFrame({\n    'region':['North','North','South','South','East','East'],\n    'category':['HW','SW','HW','SW','HW','SW'],\n    'revenue':[747, 594, 1899, 1600, 1498, 1485]\n})\n\nwide = df.pivot_table(index='region', columns='category',\n                      values='revenue', aggfunc='sum')\nprint(wide)",
  task:'Print total revenue per region, sorted from highest to lowest.',
  solution:"import pandas as pd\ndf = pd.DataFrame({'region':['North','North','South','South','East','East'],'category':['HW','SW','HW','SW','HW','SW'],'revenue':[747,594,1899,1600,1498,1485]})\nprint(df.groupby('region')['revenue'].sum().sort_values(ascending=False))",
  expect:"region\nSouth    3499\nEast     2983\nNorth    1341\nName: revenue, dtype: int64",
  hint:'groupby, sum, then .sort_values(ascending=False).'
},

'excel-0':{
  title:'References, and why one dollar sign matters',
  scenario:'You build a commission column, drag it down twenty rows, and every value below the first is wrong. <b>This exact bug appears in real company spreadsheets constantly</b> and it comes down to one character.',
  concept:`<p>A reference like <code>B2</code> is <em>relative</em>: copy the formula down one row and it becomes <code>B3</code>. Usually that is what you want.</p>
<p>A reference like <code>$B$2</code> is <em>absolute</em>: it stays on B2 no matter where you copy it. Use it for a single fixed input — a tax rate, a commission percentage, an exchange rate sitting in one cell.</p>
<p>Mixed forms exist too: <code>$B2</code> locks the column, <code>B$2</code> locks the row. That is how one formula fills an entire grid correctly.</p>
<p>Start with the arithmetic that does not need locking. The grid below is live — type a formula in the bar and it evaluates against the visible data.</p>`,
  example:"=SUM(F2:F11)",
  task:'Write a formula that returns the <b>average</b> of the Revenue column (F2:F11).',
  solution:"=AVERAGE(F2:F11)",
  expect:1306.3,
  hint:'AVERAGE works exactly like SUM. The revenue column is F, rows 2 through 11.'
},
'excel-1':{
  title:'Conditional logic and lookups',
  scenario:'Sales wants a spreadsheet that labels each deal Large or Small, counts how many landed in each region, and pulls the target for that region from a second sheet. <b>Three formulas do all of it.</b>',
  concept:`<p><code>IF(test, value_if_true, value_if_false)</code> is the branch. Nesting more than two or three deep becomes unreadable — that is when you reach for <code>IFS</code> or a lookup table.</p>
<p>The conditional aggregates are the workhorses: <code>COUNTIF(range, criteria)</code>, <code>SUMIF(range, criteria, sum_range)</code>, and <code>AVERAGEIF</code>. Criteria can be text (<code>"North"</code>) or an expression in quotes (<code>"&gt;1000"</code>).</p>
<p><code>VLOOKUP(value, table, col_index, FALSE)</code> finds a row by its first column and returns another column from it. Always pass <code>FALSE</code> for exact match — the default is approximate and returns confidently wrong answers on unsorted data. Modern Excel has <code>XLOOKUP</code>, which fixes VLOOKUP's worst habits, but VLOOKUP still appears in interviews and legacy files.</p>`,
  example:'=COUNTIF(A2:A11, "North")',
  task:'Sum the Revenue column (F2:F11) for rows where the Region column (A2:A11) is <code>South</code>.',
  solution:'=SUMIF(A2:A11, "South", F2:F11)',
  expect:5242,
  hint:'SUMIF takes three arguments: the range to test, the criteria, and the range to add up.'
},
'excel-2':{
  title:'Building a summary the reader can trust',
  scenario:'A director asks for "one tab, the numbers that matter, no scrolling." <b>The skill is subtraction</b> — deciding what not to show, and making every number auditable back to the source rows.',
  concept:`<p>A summary block is a small set of named formulas, each pointing at raw data that lives elsewhere and is never edited by hand. Three rules keep it trustworthy:</p>
<ul><li><b>No hardcoded numbers.</b> A typed <code>1306.3</code> silently goes stale the moment the data updates. Every cell should be a formula.</li>
<li><b>One source of truth.</b> The raw rows live on one sheet; the summary references it. Copy-pasting values creates two versions that drift apart.</li>
<li><b>Label the ambiguous.</b> "Revenue" is not a unit. "Revenue, EUR, excl. VAT" is.</li></ul>
<p>Useful here: <code>MAX</code> and <code>MIN</code> for range, <code>COUNTA</code> for non-empty counts, <code>ROUND(x, 2)</code> to stop currency rendering to eight decimals.</p>`,
  example:"=ROUND(AVERAGE(F2:F11), 2)",
  task:'Return the <b>largest</b> value in the Revenue column (F2:F11), rounded to zero decimals.',
  solution:"=ROUND(MAX(F2:F11), 0)",
  expect:2560,
  hint:'Nest MAX inside ROUND, with 0 as the second argument to ROUND.'
},

'r-0':{
  title:'Data frames and the dplyr verbs',
  scenario:'You have joined a team that runs on R. <b>Everything they write is five verbs chained with a pipe</b>, and once you see the pattern the rest of their codebase opens up.',
  concept:`<p>dplyr names each operation after what it does, and <code>%>%</code> (or the newer <code>|></code>) passes the result of one into the next.</p>
<ul><li><code>filter()</code> keeps rows — pandas' boolean mask, SQL's WHERE.</li>
<li><code>select()</code> keeps columns.</li>
<li><code>mutate()</code> adds or overwrites a column.</li>
<li><code>arrange()</code> sorts; wrap a column in <code>desc()</code> for descending.</li>
<li><code>summarise()</code> collapses to one row, and paired with <code>group_by()</code> it becomes one row per group.</li></ul>
<p>Read a pipeline top to bottom as a sentence: take the data, then filter, then mutate, then arrange. It maps almost one-to-one onto SQL, which is why analysts move between the two easily.</p>`,
  example:"library(dplyr)\n\nstaff <- data.frame(\n  name = c(\"Amira\",\"Luca\",\"Sara\",\"Mei\"),\n  dept = c(\"Data\",\"Data\",\"Data\",\"Data\"),\n  salary = c(82000, 96000, 61000, 118000)\n)\n\nstaff %>%\n  filter(salary > 70000) %>%\n  mutate(monthly = round(salary / 12)) %>%\n  arrange(desc(salary))",
  output:"   name dept salary monthly\n1   Mei Data 118000    9833\n2  Luca Data  96000    8000\n3 Amira Data  82000    6833",
  task:'Write a pipeline that keeps only rows with <code>salary &gt;= 82000</code>, then returns the mean salary as a column named <code>avg_salary</code>.',
  solution:"staff %>%\n  filter(salary >= 82000) %>%\n  summarise(avg_salary = mean(salary))",
  hint:'filter first, then summarise with a named argument.'
},
'r-1':{
  title:'ggplot2 and the grammar of graphics',
  scenario:'Your chart has to go in a report that leaves the company. <b>Default styling reads as unfinished</b>, and ggplot gives you control over every layer without fighting a chart wizard.',
  concept:`<p>ggplot builds a plot in layers, each added with <code>+</code>.</p>
<ul><li><code>ggplot(data, aes(x =, y =, colour =))</code> maps columns to visual properties. This is the "aesthetic mapping" — nothing is drawn yet.</li>
<li><code>geom_point()</code>, <code>geom_col()</code>, <code>geom_line()</code> choose the marks.</li>
<li><code>geom_smooth(method = "lm")</code> overlays a fitted line. Set <code>se = FALSE</code> to drop the confidence band when it clutters.</li>
<li><code>labs()</code> sets titles and axis labels. An unlabelled axis is an unfinished chart.</li>
<li><code>theme_minimal()</code> strips the grey default panel.</li></ul>
<p>The discipline: one message per chart. If you cannot say in a sentence what the reader should take away, the chart is not ready.</p>`,
  example:"library(ggplot2)\n\nggplot(staff, aes(x = years_exp, y = salary)) +\n  geom_point(size = 3) +\n  geom_smooth(method = \"lm\", se = FALSE) +\n  labs(title = \"Salary rises with experience\",\n       x = \"Years of experience\",\n       y = \"Salary (EUR)\") +\n  theme_minimal()",
  output:"# Renders a scatter plot with a fitted straight line.\n# `geom_smooth(method = \"lm\")` prints a message naming\n# the formula it used: 'y ~ x'",
  task:'Adapt the example into a bar chart of salary by name, sorted, with a title. Use <code>geom_col()</code>.',
  solution:"ggplot(staff, aes(x = reorder(name, salary), y = salary)) +\n  geom_col() +\n  coord_flip() +\n  labs(title = \"Salary by employee\", x = NULL, y = \"Salary (EUR)\") +\n  theme_minimal()",
  hint:'reorder(name, salary) sorts the bars; coord_flip() makes long labels readable.'
},
'r-2':{
  title:'Fitting a model and reading the output',
  scenario:'"Does experience actually explain salary here, or are we imagining it?" <b>The answer is a model and an honest reading of its output</b> — including saying when the evidence is thin.',
  concept:`<p><code>lm(y ~ x1 + x2, data = df)</code> fits a linear model. <code>summary(model)</code> prints what matters:</p>
<ul><li><b>Estimate</b> — the change in y for a one-unit change in x, holding the others fixed. This is the number people quote.</li>
<li><b>Std. Error</b> — how uncertain that estimate is. A large estimate with a larger standard error is not a finding.</li>
<li><b>p-value</b> — the probability of seeing an effect this large if the true effect were zero. It is not the probability the effect is real, and it says nothing about whether the effect is big enough to matter.</li>
<li><b>R-squared</b> — the share of variance explained. High R-squared on training data can simply mean you overfit.</li></ul>
<p>The professional move is to state the estimate, its uncertainty, and the limits of the data — small n, observational, confounders. Overclaiming from a model is the fastest way to lose a stakeholder's trust.</p>`,
  example:"model <- lm(salary ~ years_exp, data = staff)\nsummary(model)\n\n# Predict and score on held-out rows\npreds <- predict(model, newdata = test_staff)\nrmse  <- sqrt(mean((preds - test_staff$salary)^2))",
  output:"Coefficients:\n            Estimate Std. Error t value Pr(>|t|)\n(Intercept)  45231.7     6104.2   7.410 4.21e-06\nyears_exp     6412.9      982.5   6.527 1.83e-05\n\nMultiple R-squared:  0.7623,  Adjusted R-squared:  0.7444\n\n# Read: each extra year is associated with about\n# EUR 6,400 more salary. R-squared 0.76 on 15 rows —\n# suggestive, not conclusive.",
  task:'Extend the model to include <code>dept</code> as a second predictor, then print the summary.',
  solution:"model2 <- lm(salary ~ years_exp + dept, data = staff)\nsummary(model2)",
  hint:'Add predictors with +. R converts the text column into indicator variables for you.'
},

'pbi-0':{
  title:'Getting data in, and fixing it before it lands',
  scenario:'Someone hands you a messy export and asks for a dashboard by Friday. <b>Every minute spent cleaning in Power Query is a minute you never spend again</b> — the steps replay automatically on next month\'s file.',
  concept:`<p>Power BI has two stages, and beginners conflate them.</p>
<p><b>Power Query</b> is where data is loaded and reshaped. Each action you take is recorded as a step in a list. When new data arrives with the same structure, all the steps rerun. Cleaning here is permanent; cleaning by hand in Excel first is not.</p>
<p>The steps that matter most: promote the first row to headers, set each column's data type explicitly, remove blank and error rows, and unpivot columns when months are spread across columns instead of down rows.</p>
<p><b>The model</b> is where tables relate to each other. A star schema — one central fact table of events, small dimension tables of attributes around it — is what Power BI is built for. One flat wide table works for a demo and then becomes unmaintainable.</p>
<p>Type your columns properly. A date stored as text will not sort chronologically, and no amount of DAX fixes it downstream.</p>`,
  example:"Query steps recorded by Power Query:\n\n1. Source            → Csv.Document(File.Contents(\"sales.csv\"))\n2. Promoted Headers  → first row becomes column names\n3. Changed Type      → order_date: Date, revenue: Decimal\n4. Removed Errors    → drops rows that failed conversion\n5. Filtered Rows     → revenue <> null",
  task:'Name the four cleaning steps you would apply to a monthly sales export where months sit across columns, then say why unpivoting matters.',
  solution:"Promote headers, set explicit types, remove error and blank rows,\nand unpivot the month columns into two columns: Month and Value.\n\nUnpivoting matters because visuals and time intelligence need one\nrow per observation. Twelve month columns cannot be plotted as a\nsingle time series or filtered by a date slicer.",
  hint:'The reshaping step is the one with a specific name — think about what turns wide into long.'
},
'pbi-1':{
  title:'Choosing visuals that answer the question',
  scenario:'Your first dashboard draft has nine charts and the director asks "so what?" <b>The fix is almost always fewer visuals</b>, arranged so the answer is the first thing seen.',
  concept:`<p>The visual follows the question, not the other way round.</p>
<ul><li><b>One current number</b> → a card. Not a one-bar bar chart.</li>
<li><b>Comparing categories</b> → a bar chart, horizontal when labels are long. Ranked, not alphabetical.</li>
<li><b>Change over time</b> → a line chart. Time runs left to right, always.</li>
<li><b>Part of a whole</b> → a stacked bar. Pie charts fail past three slices because people cannot compare angles.</li>
<li><b>Many values across two categories</b> → a matrix or heatmap, not fifteen small charts.</li></ul>
<p>Layout carries meaning too: readers scan top-left first, so the headline number goes there and the detail goes below. Slicers belong together on one edge, not scattered.</p>
<p>Build a layout below — the tiles render live.</p>`,
  task:'Configure the builder so it answers "which category earns the most, and how has total revenue moved through the year?" Then mark this done.',
  solution:"A card for total revenue, a bar chart of revenue by category sorted\ndescending, and a line chart of revenue by month.\n\nThree visuals, one question each. The card answers 'how much',\nthe bar answers 'where from', the line answers 'which direction'.",
  hint:'Two questions were asked, plus a headline number. That is three visuals, not nine.'
},
'pbi-2':{
  title:'DAX: measures, columns, and context',
  scenario:'Your total revenue card reads correctly until someone clicks a slicer, and then it shows the same number for every region. <b>You wrote a calculated column where you needed a measure.</b>',
  concept:`<p>The distinction that trips up everyone learning DAX:</p>
<ul><li>A <b>calculated column</b> is computed once per row when data loads and stored in the model. It does not react to slicers.</li>
<li>A <b>measure</b> is computed on demand, in whatever filter context the visual is in. Slice by region and it recalculates for that region.</li></ul>
<p>Rule of thumb: if it aggregates, make it a measure. Columns are for row-level attributes you will group or filter by.</p>
<p><code>CALCULATE</code> is the one function to really learn — it evaluates an expression with the filter context modified:</p>
<ul><li><code>CALCULATE([Revenue], ALL(Sales))</code> ignores filters, giving a grand total for share-of-total ratios.</li>
<li><code>CALCULATE([Revenue], DATESYTD(Calendar[Date]))</code> gives year-to-date, provided you have a proper marked date table.</li></ul>
<p>Time intelligence silently misbehaves without a dedicated date table with continuous dates. Build one before you need it.</p>`,
  example:"Revenue = SUMX(Sales, Sales[quantity] * Sales[unit_price])\n\nRevenue YTD =\nCALCULATE([Revenue], DATESYTD('Calendar'[Date]))\n\nRevenue PY =\nCALCULATE([Revenue], SAMEPERIODLASTYEAR('Calendar'[Date]))\n\nYoY % =\nDIVIDE([Revenue] - [Revenue PY], [Revenue PY])",
  task:'Write a measure giving each category\'s share of total revenue, and explain why <code>ALL</code> is required.',
  solution:"Category Share % =\nDIVIDE(\n    [Revenue],\n    CALCULATE([Revenue], ALL(Sales[category]))\n)\n\nALL removes the category filter from the denominator only, so it\nstays the grand total while the numerator stays filtered to the\ncurrent row's category. Without ALL, both sides are filtered\nidentically and every row returns 100%.\n\nUse DIVIDE, not '/', because DIVIDE returns blank instead of an\nerror when the denominator is zero.",
  hint:'The numerator is filtered, the denominator must not be. One function removes a filter.'
}
};
