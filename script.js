const currencyRates = {
  EUR: 1.08,
  GBP: 1.27,
  USD: 1,
  CHF: 1.12,
  SEK: 0.093,
  NOK: 0.095,
  INR: 0.012,
  PLN: 0.26,
  CAD: 0.74,
};

let jobs = [];
let salaries = [];

window.onload = async () => {
  jobs = await loadTSV('jobs.csv');
  salaries = await loadTSV('salary.csv');

  console.log(`✅ Jobs loaded: ${jobs.length}`);
  console.log(`✅ Salaries loaded: ${salaries.length}`);
  console.log("📌 Sample job row:", jobs[0]);

  populateCountries();
  setupListeners();
};

function setupListeners() {
  document.getElementById('countrySelect').addEventListener('change', updateUI);
  document.getElementById('jobInput').addEventListener('input', updateUI);
}

async function loadTSV(path) {
  try {
    const res = await fetch(path);
    const text = await res.text();
    const lines = text.trim().split('\n');
    const keys = lines[0].split('\t');

    return lines.slice(1).map(line => {
      const values = line.split('\t');
      return keys.reduce((obj, key, i) => {
        obj[key.trim()] = values[i]?.trim() || '';
        return obj;
      }, {});
    });
  } catch (err) {
    console.error(`❌ Failed to load ${path}:`, err);
    return [];
  }
}

function trackSearchEvent(query, country) {
  if (window.gtag) {
    gtag('event', 'search', {
      event_category: 'JobExplorer',
      event_label: country,
      search_term: query
    });
  }
}

function populateCountries() {
  const select = document.getElementById('countrySelect');
  select.innerHTML = '<option value="">Select country</option>';

  const uniqueCountries = [...new Set(salaries.map(s => s.Country).filter(Boolean))].sort();
  uniqueCountries.forEach(country => {
    const option = document.createElement('option');
    option.value = country;
    option.textContent = country;
    select.appendChild(option);
  });
}

function convertToUSD(amount, fromCurrency) {
  const rate = currencyRates[fromCurrency] || 1;
  const usd = parseFloat(amount) * rate;
  return `$${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function updateUI() {
  const country = document.getElementById('countrySelect').value;
  const jobQuery = document.getElementById('jobInput').value.trim().toLowerCase();
  const normalizedCountry = country.trim().toLowerCase();

  const salaryBox = document.getElementById('salaryOutput');
  const jobResults = document.getElementById('jobResults');

  salaryBox.innerHTML = '';
  jobResults.innerHTML = '';

  if (!country) return;

  // 💰 Render Salary Info
  const matchedSalaries = salaries.filter(s =>
    (s.Country || '').trim().toLowerCase() === normalizedCountry
  );

  if (matchedSalaries.length > 0) {
    const s = matchedSalaries[0];
    const min = convertToUSD(s.MinSalary, s.CurrencyTicker);
    const med = convertToUSD(s.MedianSalary, s.CurrencyTicker);

    salaryBox.innerHTML = `
      <div class="rounded-md bg-gray-50 border border-gray-200 p-4">
        <div class="text-sm text-gray-500">Estimated Yearly Salary Range</div>
        <div class="text-2xl font-semibold text-gray-800">
          ${min} – ${med} <span class="text-sm text-gray-500 ml-1">- USD not ${s.CurrencyTicker}</span>
        </div>
      </div>
    `;
  } else {
    salaryBox.innerHTML = `<div class="text-gray-500 text-sm">No salary data for this country.</div>`;
  }

  // 🧠 Show Fun Facts if no job query
  if (jobQuery.length < 2) {
    trackSearchEvent(jobQuery, country);
    renderFunFactsForCountry(normalizedCountry);
    return;
  }

  // 🔍 Filter and render jobs
  const matchedJobs = jobs.filter(j =>
    (j.Country || '').trim().toLowerCase() === normalizedCountry &&
    (j.JobTitle || '').toLowerCase().includes(jobQuery)
  );

  if (matchedJobs.length === 0) {
    jobResults.innerHTML = `<div class="text-gray-500 text-sm">No matching jobs found.</div>`;
    return;
  }

  matchedJobs.slice(0, 10).forEach(job => {
    const card = document.createElement('div');
    card.className = 'border rounded p-4 shadow-sm bg-gray-50';

    card.innerHTML = `
      <div class="font-semibold text-lg">${job.JobTitle}</div>
      <div class="text-sm text-gray-600">${job.CompanyName} — ${job.City}</div>
      <a href="${job.JobURL}" target="_blank" class="text-blue-600 underline text-sm mt-2 inline-block">View Job</a>
    `;

    jobResults.appendChild(card);
  });
}

function renderFunFactsForCountry(normalizedCountry) {
  const jobResults = document.getElementById('jobResults');
  const countryJobs = jobs.filter(j =>
    (j.Country || '').trim().toLowerCase() === normalizedCountry
  );

  if (countryJobs.length === 0) {
    jobResults.innerHTML = `<div class="text-gray-500 text-sm">No job data for this country.</div>`;
    return;
  }

  // 🧠 Most common job title
  const titleCount = {};
  countryJobs.forEach(j => {
    const title = j.JobTitle || '';
    titleCount[title] = (titleCount[title] || 0) + 1;
  });
  const mostCommonTitle = Object.entries(titleCount).sort((a, b) => b[1] - a[1])[0];

  // 💰 Median salary
  const matchedSalaries = salaries.filter(s =>
    (s.Country || '').trim().toLowerCase() === normalizedCountry
  );
  const medianSalary = matchedSalaries[0]?.MedianSalary || 'N/A';
  const currency = matchedSalaries[0]?.CurrencyTicker || '';

  // 📊 Job count
  const total = countryJobs.length;

  const facts = [
    `📌 Most common job: <strong>${mostCommonTitle[0]}</strong> (${mostCommonTitle[1]} listings)`,
    `💶 Median salary: <strong>${medianSalary} ${currency}</strong>`,
    `📊 Total job postings: <strong>${total}</strong>`,
  ];

  jobResults.innerHTML = facts.map(fact => `
    <div class="bg-white border rounded p-4 shadow text-sm">${fact}</div>
  `).join('');

  jobResults.innerHTML += renderTopJobsChart(countryJobs);
}

function renderTopJobsChart(jobList) {
  const count = {};
  jobList.forEach(j => {
    const t = j.JobTitle;
    count[t] = (count[t] || 0) + 1;
  });

  const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = top[0][1];

  return `
    <div class="space-y-1 mt-4">
      <div class="text-sm font-medium text-gray-700">Top Job Titles:</div>
      ${top.map(([title, num]) => `
        <div class="flex items-center text-sm">
          <span class="w-32 truncate">${title}</span>
          <div class="ml-2 flex-1 bg-gray-200 h-2 rounded">
            <div class="bg-blue-600 h-2 rounded" style="width:${(num / max) * 100}%"></div>
          </div>
          <span class="ml-2 text-xs text-gray-500">${num}</span>
        </div>
      `).join('')}
    </div>
  `;
}


