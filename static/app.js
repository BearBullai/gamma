// Sidebar tab navigation
const navLinks = document.querySelectorAll('.sidebar nav a');
const sections = [
    'calculator-section',
    'results-section',
    'chart-section',
    'visual-section',
    'info-section'
];
navLinks.forEach((link, idx) => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        sections.forEach((sec, i) => {
            document.getElementById(sec).style.display = (i === idx) ? 'block' : 'none';
        });
    });
});
sections.forEach((sec, i) => {
    document.getElementById(sec).style.display = (i === 0) ? 'block' : 'none';
});

// Snackbar
function showSnackbar(msg) {
    const sb = document.getElementById('snackbar');
    sb.textContent = msg;
    sb.className = 'show';
    setTimeout(() => { sb.className = sb.className.replace('show', ''); }, 3000);
}

// Animate value
function animateValue(el, start, end, duration = 800) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        el.textContent = (start + (end - start) * progress).toFixed(4);
        if (progress < 1) window.requestAnimationFrame(step);
        else el.textContent = end.toFixed(4);
    };
    window.requestAnimationFrame(step);
}

const metricInfo = {
    'Call Price': {icon: '📈', tip: 'Option Call Price'},
    'Put Price': {icon: '📉', tip: 'Option Put Price'},
    'Delta': {icon: 'Δ', tip: 'Sensitivity to underlying price'},
    'Gamma': {icon: 'Γ', tip: 'Sensitivity of Delta to price'},
    'Vega': {icon: 'ν', tip: 'Sensitivity to volatility'},
    'Theta': {icon: 'Θ', tip: 'Sensitivity to time decay'},
    'Rho': {icon: 'ρ', tip: 'Sensitivity to interest rate'}
};

// Nifty toggle
const niftyToggle = document.getElementById('nifty-toggle');
const niftyDateGroup = document.getElementById('nifty-date-group');
const fetchNiftyBtn = document.getElementById('fetch-nifty');
const niftyLoading = document.getElementById('nifty-loading');
const niftyBenchmarkSection = document.getElementById('nifty-benchmark-section');
const niftyBenchmarkResults = document.getElementById('nifty-benchmark-results');
let niftyData = null;

niftyToggle.addEventListener('change', function() {
    if (niftyToggle.value === 'on') {
        niftyDateGroup.style.display = 'block';
        const end = new Date();
        const start = new Date();
        start.setMonth(end.getMonth() - 3);
        document.getElementById('nifty-start').value = start.toISOString().slice(0,10);
        document.getElementById('nifty-end').value = end.toISOString().slice(0,10);
    } else {
        niftyDateGroup.style.display = 'none';
        niftyBenchmarkSection.style.display = 'none';
        niftyData = null;
    }
});

fetchNiftyBtn.addEventListener('click', async function() {
    niftyLoading.style.display = 'inline';
    niftyBenchmarkResults.innerHTML = '';
    const start = document.getElementById('nifty-start').value;
    const end = document.getElementById('nifty-end').value;
    try {
        const resp = await fetch(`/nifty?start=${start}&end=${end}`);
        const data = await resp.json();
        niftyData = data;
        niftyBenchmarkSection.style.display = 'block';
        niftyBenchmarkResults.innerHTML = `<b>Nifty Close Prices:</b><br>${data.dates.map((d,i) => `${d}: ₹${data.closes[i]}`).join('<br>')}`;
        showSnackbar('Nifty data loaded!');
    } catch (e) {
        niftyBenchmarkResults.innerHTML = '<span style="color:red">Failed to fetch Nifty data.</span>';
        showSnackbar('Failed to fetch Nifty data.');
    }
    niftyLoading.style.display = 'none';
});

// Calculator form
const form = document.getElementById('vg-form');
form.onsubmit = async function(e) {
    e.preventDefault();
    showSnackbar('Calculating...');
    navLinks.forEach(l => l.classList.remove('active'));
    navLinks[1].classList.add('active');
    sections.forEach((sec) => {
        document.getElementById(sec).style.display = ['results-section','chart-section','visual-section'].includes(sec) ? 'block' : 'none';
    });
    const data = {};
    for (let el of form.elements) {
        if (el.name) data[el.name] = el.value;
    }

    let Svals = [];
    let S0 = parseFloat(data.S);
    for (let S = 0.5 * S0; S <= 1.5 * S0; S += S0 / 10) Svals.push(S);

    const chartResults = await Promise.all(
        Svals.map(S => fetch('/calculate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({...data, S})
        }).then(r => r.json()))
    );

    const result = chartResults[Math.floor(chartResults.length / 2)];

    const vgMetrics = [['Call Price', 'VG Call Price'], ['Put Price', 'VG Put Price'], ['Delta', 'VG Delta'], ['Gamma', 'VG Gamma'], ['Vega', 'VG Vega'], ['Theta', 'VG Theta'], ['Rho', 'VG Rho']];
    const bsMetrics = [['Call Price', 'BS Call Price'], ['Put Price', 'BS Put Price'], ['Delta', 'BS Delta'], ['Gamma', 'BS Gamma'], ['Vega', 'BS Vega'], ['Theta', 'BS Theta'], ['Rho', 'BS Rho']];
    const vgGrid = document.getElementById('vg-metrics');
    const bsGrid = document.getElementById('bs-metrics');
    vgGrid.innerHTML = '';
    bsGrid.innerHTML = '';

    for (let [label, key] of vgMetrics) {
        let val = result[key];
        let card = document.createElement('div');
        card.className = 'metric-card neon';
        card.innerHTML = `<div class="metric-title"><span class="icon">${metricInfo[label].icon}</span>${label} <span class="tooltip" title="${metricInfo[label].tip}">?</span></div><div class="metric-value">${val}</div>`;
        vgGrid.appendChild(card);
        if (!isNaN(parseFloat(val))) animateValue(card.querySelector('.metric-value'), 0, parseFloat(val));
    }

    for (let [label, key] of bsMetrics) {
        let val = result[key];
        let card = document.createElement('div');
        card.className = 'metric-card neon';
        card.innerHTML = `<div class="metric-title"><span class="icon">${metricInfo[label].icon}</span>${label} <span class="tooltip" title="${metricInfo[label].tip}">?</span></div><div class="metric-value">${val}</div>`;
        bsGrid.appendChild(card);
        if (!isNaN(parseFloat(val))) animateValue(card.querySelector('.metric-value'), 0, parseFloat(val));
    }

    showSnackbar('Results updated!');
    showSnackbar('Generating charts...');
    
    const plotMetrics = [
        {label: 'Call Price', vg: 'VG Call Price', bs: 'BS Call Price'},
        {label: 'Put Price', vg: 'VG Put Price', bs: 'BS Put Price'},
        {label: 'Delta', vg: 'VG Delta', bs: 'BS Delta'},
        {label: 'Gamma', vg: 'VG Gamma', bs: 'BS Gamma'},
        {label: 'Vega', vg: 'VG Vega', bs: 'BS Vega'},
        {label: 'Theta', vg: 'VG Theta', bs: 'BS Theta'},
        {label: 'Rho', vg: 'VG Rho', bs: 'BS Rho'}
    ];

    const chartsGrid = document.getElementById('chart');
    chartsGrid.innerHTML = '';
    function parseVal(val) {
        if (typeof val === 'string' && (val.startsWith('₹') || val.startsWith('$'))) return parseFloat(val.replace(/[^\d.-]/g, ''));
        return parseFloat(val);
    }

    for (let m of plotMetrics) {
        let vgY = chartResults.map(r => parseVal(r[m.vg])).filter(v => !isNaN(v));
        let bsY = chartResults.map(r => parseVal(r[m.bs])).filter(v => !isNaN(v));
        let chartId = `chart_${m.label.replace(/ /g,'_')}`;
        let chartDiv = document.createElement('div');
        chartDiv.style.marginBottom = '32px';
        chartDiv.innerHTML = `<div class="chart-title"><span class="icon">${metricInfo[m.label].icon}</span>${m.label} Comparison</div><div id="${chartId}" style="height:320px;"></div>`;
        chartsGrid.appendChild(chartDiv);
        Plotly.newPlot(chartId, [
            {x: Svals, y: vgY, name: 'VG', mode: 'lines+markers', line: {color: '#FF6C00'}, marker: {color: '#FF6C00'}},
            {x: Svals, y: bsY, name: 'BS', mode: 'lines+markers', line: {color: '#00bfff'}, marker: {color: '#00bfff'}}
        ], {
            paper_bgcolor: '#0a0a0f',
            plot_bgcolor: '#181818',
            font: {color: '#FF6C00', family: 'Orbitron, Exo 2, Segoe UI, Arial'},
            xaxis: {title: 'Spot Price (S)'},
            yaxis: {title: m.label},
            legend: {x: 0.8, y: 1.1, orientation: 'h'},
            margin: {l: 40, r: 20, t: 40, b: 40}
        });
    }

    showSnackbar('Charts updated!');
    showSnackbar('Generating 3D visualizations...');
    
    const S3 = [], sigma3 = [];
    let Smin = 0.5 * data.S, Smax = 1.5 * data.S;
    let sigmamin = 0.5 * data.sigma, sigmamax = 1.5 * data.sigma;
    for (let i = 0; i <= 10; i++) {
        S3.push(Smin + (Smax - Smin) * i / 10);
        sigma3.push(sigmamin + (sigmamax - sigmamin) * i / 10);
    }

    const visualsGrid = document.getElementById('plot3d_call');
    visualsGrid.innerHTML = '';

    for (let m of plotMetrics) {
        let zVG = Array(S3.length).fill().map(() => Array(sigma3.length).fill(null));
        let zBS = Array(S3.length).fill().map(() => Array(sigma3.length).fill(null));

        const all3dPromises = [];
        for (let i = 0; i < S3.length; i++) {
            for (let j = 0; j < sigma3.length; j++) {
                let params = {...data, S: S3[i], sigma: sigma3[j]};
                all3dPromises.push(
                    fetch('/calculate', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(params)
                    }).then(r => r.json().then(res => ({i, j, res})))
                );
            }
        }

        let all3dResults = await Promise.all(all3dPromises);
        for (let {i, j, res} of all3dResults) {
            zVG[i][j] = parseVal(res[m.vg]);
            zBS[i][j] = parseVal(res[m.bs]);
        }

        let visualId = `visual_${m.label.replace(/ /g,'_')}`;
        let visualDiv = document.createElement('div');
        visualDiv.style.marginBottom = '32px';
        visualDiv.innerHTML = `<div class="chart-title"><span class="icon">${metricInfo[m.label].icon}</span>${m.label} 3D Surface</div><div id="${visualId}" style="height:340px;"></div>`;
        visualsGrid.appendChild(visualDiv);
        Plotly.newPlot(visualId, [
            {
                z: zVG, x: S3, y: sigma3, type: 'surface', name: 'VG', showscale: false, opacity: 0.8,
                colorscale: 'YlOrRd',
                contours: {z: {show: true, usecolormap: true, highlightcolor: '#FF6C00', project: {z: true}}},
                hovertemplate: 'S=%{x}<br>σ=%{y}<br>VG=%{z}<extra></extra>'
            },
            {
                z: zBS, x: S3, y: sigma3, type: 'surface', name: 'BS', showscale: false, opacity: 0.5,
                colorscale: 'Blues',
                contours: {z: {show: true, usecolormap: true, highlightcolor: '#00bfff', project: {z: true}}},
                hovertemplate: 'S=%{x}<br>σ=%{y}<br>BS=%{z}<extra></extra>'
            }
        ], {
            title: `${m.label} 3D Surface (VG vs BS)`,
            scene: {
                xaxis: {title: 'Spot Price (S)'},
                yaxis: {title: 'Volatility (σ)'},
                zaxis: {title: m.label},
                bgcolor: '#181818',
            },
            paper_bgcolor: '#0a0a0f',
            font: {color: '#FF6C00', family: 'Orbitron, Exo 2, Segoe UI, Arial'},
            autosize: true,
            margin: {l: 0, r: 0, b: 0, t: 40},
            legend: {x: 0.8, y: 1.1, orientation: 'h'}
        });
    }

    showSnackbar('3D Visualizations updated!');
};

// Download button
const downloadBtn = document.getElementById('download-chart');
if (downloadBtn) {
    downloadBtn.onclick = function() {
        const chartEl = document.getElementById('chart');
        if (chartEl) {
            Plotly.downloadImage(chartEl, {format: 'png', filename: 'option_chart'});
            showSnackbar('Chart downloaded!');
        }
    };
}

// Tooltip behavior
document.querySelectorAll('.tooltip').forEach(tip => {
    tip.addEventListener('mouseenter', function() {
        showSnackbar(tip.getAttribute('title'));
    });
});

async function uploadCsv(event) {
    event.preventDefault(); // Prevent default form submission

    const fileInput = document.getElementById('csvFile');
    const csvUnderlyingS = parseFloat(document.getElementById('csvUnderlyingS').value);
    console.log('Underlying S value:', csvUnderlyingS); // Debug: log the value
    const file = fileInput.files[0];
    const statusDiv = document.getElementById('csvStatus');
    const resultsTableBody = document.querySelector('#csv-results-table tbody');
    console.log('resultsTableBody:', resultsTableBody); // Debug: check if tbody is found
    const csvResultsDiv = document.getElementById('csv-results-table');

    // Clear previous results and status
    statusDiv.innerHTML = '';
    resultsTableBody.innerHTML = '';
    statusDiv.classList.add('hidden');
    csvResultsDiv.classList.add('hidden');

    if (!file) {
        showSnackbar('Please select a CSV file.', 'error');
        return;
    }
    if (isNaN(csvUnderlyingS) || csvUnderlyingS <= 0) {
        showSnackbar('Please enter a valid positive Underlying Price (S) for CSV calculations.', 'error');
        return;
    }

    // Create FormData object to send file and other data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('underlying_s', csvUnderlyingS); // Send underlying S with CSV

    statusDiv.innerHTML = '<p class="text-center" style="color:#FF6C00;">Uploading and analyzing CSV...</p>';
    statusDiv.classList.remove('hidden');

    try {
        const response = await fetch('/upload_csv', {
            method: 'POST',
            body: formData, // No 'Content-Type' header needed for FormData
        });
        const data = await response.json();

        if (response.ok) {
            if (data.results && data.results.length > 0) {
                showSnackbar(`Successfully processed ${data.results.length} rows. ${data.row_errors} rows skipped due to errors.`, 'success');
                data.results.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${row['DATE']}</td>
                        <td>${row['STRIKE PRICE'].toFixed(2)}</td>
                        <td>${row['SETTLE PRICE'].toFixed(2)}</td>
                        <td>₹${row['VG Call Price'].toFixed(2)}</td>
                        <td>${row['VG Delta'].toFixed(4)}</td>
                        <td>${row['VG Gamma'].toFixed(4)}</td>
                        <td>${row['VG Vega'].toFixed(4)}</td>
                        <td>${row['VG Theta'].toFixed(4)}</td>
                        <td>${row['VG Rho'].toFixed(4)}</td>
                        <td>₹${row['BS Call Price'].toFixed(2)}</td>
                        <td>${row['BS Delta'].toFixed(4)}</td>
                        <td>${row['BS Gamma'].toFixed(4)}</td>
                        <td>${row['BS Vega'].toFixed(4)}</td>
                        <td>${row['BS Theta'].toFixed(4)}</td>
                        <td>${row['BS Rho'].toFixed(4)}</td>
                    `;
                    resultsTableBody.appendChild(tr);
                });
                csvResultsDiv.classList.remove('hidden'); // Show results table
                statusDiv.classList.add('hidden'); // Hide status div if results table is shown
            } else {
                showSnackbar(`No valid data processed from CSV. ${data.row_errors} rows failed. Please check your CSV file and the provided Underlying Price (S).`, 'error');
                csvResultsDiv.classList.add('hidden');
            }
        } else {
            showSnackbar(`Error: ${data.error || 'Unknown error during CSV upload.'}`, 'error');
            csvResultsDiv.classList.add('hidden');
        }
    } catch (error) {
        showSnackbar(`Network error during CSV upload: ${error.message}`, 'error');
        csvResultsDiv.classList.add('hidden');
    }
}
