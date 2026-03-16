/**
 * US Job Market Visualizer
 * Interactive treemap of BLS Occupational Outlook Handbook data
 */

// State
let data = null;
let currentLayer = 'outlook';
let hoveredTile = null;

// Color scales for each layer
const COLOR_SCALES = {
    outlook: {
        min: -15,
        max: 25,
        colors: [
            { stop: 0, color: [200, 50, 50] },     // Red for declining
            { stop: 0.4, color: [240, 180, 60] },  // Orange-yellow for flat
            { stop: 0.7, color: [180, 200, 80] },  // Yellow-green
            { stop: 1, color: [40, 160, 70] }      // Green for growing
        ],
        format: v => `${v > 0 ? '+' : ''}${v}%`
    },
    pay: {
        min: 25000,
        max: 180000,
        colors: [
            { stop: 0, color: [255, 230, 150] },   // Light yellow
            { stop: 0.33, color: [220, 180, 255] }, // Light purple
            { stop: 0.66, color: [160, 120, 230] }, // Medium purple
            { stop: 1, color: [100, 60, 180] }      // Deep purple
        ],
        format: v => `$${Math.round(v / 1000)}k`
    },
    education: {
        levels: [
            { level: 0, color: [180, 180, 180], label: 'N/A' },
            { level: 1, color: [140, 170, 200], label: 'No degree/HS' },
            { level: 2, color: [140, 200, 180], label: 'Postsec/Assoc' },
            { level: 3, color: [140, 200, 140], label: "Bachelor's" },
            { level: 4, color: [180, 200, 140], label: "Master's" },
            { level: 5, color: [200, 180, 140], label: 'Doctoral/Prof' }
        ],
        format: (v, edu) => edu || 'N/A'
    },
    'ai-exposure': {
        min: 0,
        max: 10,
        colors: [
            { stop: 0, color: [240, 240, 240] },   // White/light gray
            { stop: 0.25, color: [255, 210, 160] }, // Light orange
            { stop: 0.5, color: [255, 140, 80] },   // Orange
            { stop: 0.75, color: [230, 80, 60] },   // Red-orange
            { stop: 1, color: [180, 40, 50] }      // Deep red
        ],
        format: v => `${v}/10`
    }
};

// Education level names
const EDUCATION_LABELS = [
    'N/A',
    'No degree/HS',
    'Postsec/Assoc',
    "Bachelor's",
    "Master's",
    'Doctoral/Prof'
];

/**
 * Interpolate between two colors
 */
function lerpColor(color1, color2, t) {
    return [
        Math.round(color1[0] + (color2[0] - color1[0]) * t),
        Math.round(color1[1] + (color2[1] - color1[1]) * t),
        Math.round(color1[2] + (color2[2] - color1[2]) * t)
    ];
}

/**
 * Get color for a value based on current layer
 */
function getColorForValue(value, layer) {
    const scale = COLOR_SCALES[layer];

    if (layer === 'education') {
        // Education uses discrete levels
        const level = scale.levels.find(l => l.level === value);
        return level ? level.color : [200, 200, 200];
    }

    // Continuous scales
    const range = scale.max - scale.min;
    const normalized = Math.max(0, Math.min(1, (value - scale.min) / range));

    // Find which color segment we're in
    for (let i = 0; i < scale.colors.length - 1; i++) {
        const segStart = scale.colors[i].stop;
        const segEnd = scale.colors[i + 1].stop;
        const segRange = segEnd - segStart;

        if (normalized >= segStart && normalized <= segEnd) {
            const t = (normalized - segStart) / segRange;
            return lerpColor(scale.colors[i].color, scale.colors[i + 1].color, t);
        }
    }

    return scale.colors[scale.colors.length - 1].color;
}

/**
 * Format value for display
 */
function formatValue(value, layer, eduString) {
    return COLOR_SCALES[layer].format(value, eduString);
}

/**
 * Squarified treemap layout algorithm
 */
function squarify(children, x, y, width, height, result) {
    if (children.length === 0) return;

    if (children.length === 1) {
        result.push({
            ...children[0],
            x, y, width, height
        });
        return;
    }

    // Sort by size (descending)
    const sorted = [...children].sort((a, b) => b.employment - a.employment);

    // Calculate total area
    const total = sorted.reduce((sum, c) => sum + c.employment, 0);

    // Find the worst aspect ratio for splitting
    let bestRatio = Infinity;
    let bestSplit = 1;
    let rowSum = sorted[0].employment;
    let min = sorted[0].employment;
    let max = sorted[0].employment;

    for (let i = 1; i < sorted.length; i++) {
        rowSum += sorted[i].employment;
        min = Math.min(min, sorted[i].employment);
        max = Math.max(max, sorted[i].employment);

        const area = rowSum / total;
        const shortSide = Math.min(width, height);
        const ratio = Math.max(
            (shortSide * shortSide * max) / (area * area * area),
            (area * area * area) / (shortSide * shortSide * min)
        );

        if (ratio > bestRatio) {
            bestSplit = i;
            break;
        }
        bestRatio = ratio;
    }

    // Layout the row
    const rowChildren = sorted.slice(0, bestSplit);
    const remaining = sorted.slice(bestSplit);

    const rowTotal = rowChildren.reduce((sum, c) => sum + c.employment, 0);
    const rowArea = (rowTotal / total) * (width * height);

    let rowX, rowY, rowW, rowH;

    if (width >= height) {
        // Horizontal layout
        rowW = rowArea / height;
        rowH = height;
        rowX = x;
        rowY = y;

        // Layout row items vertically
        let currentY = rowY;
        const scale = rowH / rowTotal;

        for (const child of rowChildren) {
            const itemH = child.employment * scale;
            result.push({
                ...child,
                x: rowX,
                y: currentY,
                width: rowW,
                height: itemH
            });
            currentY += itemH;
        }

        // Recurse on remaining
        squarify(remaining, x + rowW, y, width - rowW, height, result);
    } else {
        // Vertical layout
        rowW = width;
        rowH = rowArea / width;
        rowX = x;
        rowY = y;

        // Layout row items horizontally
        let currentX = rowX;
        const scale = rowW / rowTotal;

        for (const child of rowChildren) {
            const itemW = child.employment * scale;
            result.push({
                ...child,
                x: currentX,
                y: rowY,
                width: itemW,
                height: rowH
            });
            currentX += itemW;
        }

        // Recurse on remaining
        squarify(remaining, x, y + rowH, width, height - rowH, result);
    }
}

/**
 * Build treemap layout
 */
function buildTreemap(occupations) {
    const layout = [];
    const canvas = document.getElementById('treemap');
    const rect = canvas.getBoundingClientRect();
    const padding = 4;

    squarify(
        occupations,
        padding,
        padding,
        rect.width - padding * 2,
        rect.height - padding * 2,
        layout
    );

    return layout;
}

/**
 * Draw the treemap
 */
function drawTreemap() {
    const canvas = document.getElementById('treemap');
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!data) return;

    const layout = buildTreemap(data.occupations);

    // Draw each tile
    for (const tile of layout) {
        const color = getColorForValue(
            currentLayer === 'ai-exposure' ? tile.ai_score :
            currentLayer === 'pay' ? tile.median_pay :
            currentLayer === 'education' ? tile.education_level :
            tile.outlook,
            currentLayer
        );

        ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        ctx.fillRect(tile.x, tile.y, tile.width - 1, tile.height - 1);

        // Draw title if space allows
        if (tile.width > 60 && tile.height > 20) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.font = '11px system-ui, sans-serif';
            const title = truncateText(tile.title, tile.width - 8);
            ctx.fillText(title, tile.x + 4, tile.y + 14);
        }

        // Store tile data for hit testing
        tile._color = color;
    }

    // Store layout for interaction
    canvas._layout = layout;
}

/**
 * Truncate text to fit width
 */
function truncateText(text, maxWidth) {
    const canvas = document.getElementById('treemap');
    const ctx = canvas.getContext('2d');
    ctx.font = '11px system-ui, sans-serif';

    if (ctx.measureText(text).width <= maxWidth) {
        return text;
    }

    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
    }

    return truncated + '...';
}

/**
 * Handle mouse move on canvas
 */
function handleMouseMove(e) {
    const canvas = e.target;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!canvas._layout) return;

    // Find hovered tile
    const tile = canvas._layout.find(t =>
        x >= t.x && x <= t.x + t.width &&
        y >= t.y && y <= t.y + t.height
    );

    if (tile !== hoveredTile) {
        hoveredTile = tile;
        canvas.style.cursor = tile ? 'pointer' : 'default';
        updateTooltip(tile, e);
    } else if (tile) {
        updateTooltipPosition(e);
    } else {
        hideTooltip();
    }
}

/**
 * Update tooltip content
 */
function updateTooltip(tile, e) {
    const tooltip = document.getElementById('tooltip');

    if (!tile) {
        hideTooltip();
        return;
    }

    const value = currentLayer === 'ai-exposure' ? tile.ai_score :
                  currentLayer === 'pay' ? tile.median_pay :
                  currentLayer === 'education' ? tile.education_level :
                  tile.outlook;

    tooltip.innerHTML = `
        <div class="tooltip-title">${tile.title}</div>
        <div class="tooltip-stat">
            <span class="label">Employment:</span>
            <span class="value">${formatNumber(tile.employment)}</span>
        </div>
        <div class="tooltip-stat">
            <span class="label">${getLayerLabel()}:</span>
            <span class="value">${formatValue(value, currentLayer, tile.education)}</span>
        </div>
        ${currentLayer === 'ai-exposure' ? `
            <div class="tooltip-rationale">${truncateRationale(tile.ai_rationale)}</div>
        ` : ''}
    `;

    tooltip.classList.remove('hidden');
    updateTooltipPosition(e);
}

/**
 * Update tooltip position
 */
function updateTooltipPosition(e) {
    const tooltip = document.getElementById('tooltip');
    const x = e.clientX + 15;
    const y = e.clientY + 15;

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

/**
 * Hide tooltip
 */
function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.classList.add('hidden');
}

/**
 * Get current layer label
 */
function getLayerLabel() {
    const labels = {
        outlook: 'Outlook',
        pay: 'Median Pay',
        education: 'Education',
        'ai-exposure': 'AI Exposure'
    };
    return labels[currentLayer];
}

/**
 * Format number with commas
 */
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(0) + 'K';
    }
    return num.toLocaleString();
}

/**
 * Truncate rationale text
 */
function truncateRationale(text) {
    if (!text) return '';
    return text.length > 150 ? text.slice(0, 150) + '...' : text;
}

/**
 * Handle click on tile
 */
function handleClick(e) {
    if (!hoveredTile) return;

    // Open BLS page in new tab
    if (hoveredTile.url) {
        window.open(hoveredTile.url, '_blank');
    }
}

/**
 * Handle layer button click
 */
function handleLayerClick(e) {
    const btn = e.currentTarget;
    const layer = btn.dataset.layer;

    if (layer === currentLayer) return;

    // Update active state
    document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentLayer = layer;

    // Update legend
    updateLegend();

    // Redraw
    drawTreemap();
}

/**
 * Update gradient legend
 */
function updateLegend() {
    const gradientBar = document.getElementById('gradient-bar');
    const legendLow = document.getElementById('legend-low');
    const legendHigh = document.getElementById('legend-high');

    if (currentLayer === 'education') {
        // Show discrete colors
        gradientBar.style.background = 'none';
        gradientBar.innerHTML = COLOR_SCALES.education.levels.map(l =>
            `<div style="background: rgb(${l.color.join(',')}); flex: 1;"></div>`
        ).join('');
        legendLow.textContent = COLOR_SCALES.education.levels[0].label;
        legendHigh.textContent = COLOR_SCALES.education.levels[COLOR_SCALES.education.levels.length - 1].label;
    } else {
        const scale = COLOR_SCALES[currentLayer];
        gradientBar.innerHTML = '';
        gradientBar.style.background = `linear-gradient(to right,
            rgb(${scale.colors[0].color.join(',')}),
            rgb(${scale.colors[scale.colors.length - 1].color.join(',')}))`;

        if (currentLayer === 'outlook') {
            legendLow.textContent = 'Declining';
            legendHigh.textContent = 'Growing';
        } else if (currentLayer === 'pay') {
            legendLow.textContent = '$' + Math.round(scale.min / 1000) + 'k';
            legendHigh.textContent = '$' + Math.round(scale.max / 1000) + 'k';
        } else if (currentLayer === 'ai-exposure') {
            legendLow.textContent = 'Low';
            legendHigh.textContent = 'High';
        }
    }
}

/**
 * Update histogram with actual data
 */
function updateHistogram() {
    if (!data || !data.occupations) return;

    const histogram = document.getElementById('outlook-histogram');
    const bars = histogram.querySelectorAll('.hist-bar');

    // Calculate employment by outlook tier
    const tiers = {
        declining: 0,   // < 0%
        low: 0,         // 0-7%
        medium: 0       // 8%+
    };

    for (const occ of data.occupations) {
        const outlook = occ.outlook || 0;
        const emp = occ.employment || 0;

        if (outlook < 0) {
            tiers.declining += emp;
        } else if (outlook <= 7) {
            tiers.low += emp;
        } else {
            tiers.medium += emp;
        }
    }

    const maxEmp = Math.max(tiers.declining, tiers.low, tiers.medium);

    // Update bar heights
    bars[0].querySelector('.bar-fill').style.height =
        Math.max(4, (tiers.declining / maxEmp) * 100) + '%';
    bars[1].querySelector('.bar-fill').style.height =
        Math.max(4, (tiers.low / maxEmp) * 100) + '%';
    bars[2].querySelector('.bar-fill').style.height =
        Math.max(4, (tiers.medium / maxEmp) * 100) + '%';
}

/**
 * Update statistics panel
 */
function updateStats() {
    if (!data || !data.metadata) return;

    const m = data.metadata;

    // Summary stats
    document.getElementById('total-occupations').textContent = m.total_occupations;
    document.getElementById('total-employment').textContent = formatNumber(m.total_employment);
    document.getElementById('stat-total-jobs').textContent = formatNumber(m.total_employment);
    document.getElementById('stat-avg-outlook').textContent =
        (m.average_outlook > 0 ? '+' : '') + m.average_outlook + '%';

    // Update histogram
    updateHistogram();

    // Declining/Growing
    document.getElementById('stat-declining').textContent = formatNumber(m.declining_employment);
    document.getElementById('stat-growing').textContent = formatNumber(m.growing_employment);

    // Outlook tiers
    const tierList = document.getElementById('tier-list');
    const tiers = m.outlook_tiers || {};
    tierList.innerHTML = `
        <div class="tier-item">
            <span class="tier-label">Declining (&lt;0%)</span>
            <span class="tier-value">${formatNumber(tiers.declining || 0)}</span>
            <span class="tier-percent">${Math.round(((tiers.declining || 0) / m.total_occupations) * 100)}%</span>
        </div>
        <div class="tier-item">
            <span class="tier-label">Slow (0–3%)</span>
            <span class="tier-value">${formatNumber(tiers.slow || 0)}</span>
            <span class="tier-percent">${Math.round(((tiers.slow || 0) / m.total_occupations) * 100)}%</span>
        </div>
        <div class="tier-item">
            <span class="tier-label">Average (4–7%)</span>
            <span class="tier-value">${formatNumber(tiers.average || 0)}</span>
            <span class="tier-percent">${Math.round(((tiers.average || 0) / m.total_occupations) * 100)}%</span>
        </div>
        <div class="tier-item">
            <span class="tier-label">Fast (8–14%)</span>
            <span class="tier-value">${formatNumber(tiers.fast || 0)}</span>
            <span class="tier-percent">${Math.round(((tiers.fast || 0) / m.total_occupations) * 100)}%</span>
        </div>
        <div class="tier-item">
            <span class="tier-label">Much faster (15%+)</span>
            <span class="tier-value">${formatNumber(tiers.much_faster || 0)}</span>
            <span class="tier-percent">${Math.round(((tiers.much_faster || 0) / m.total_occupations) * 100)}%</span>
        </div>
    `;

    // Calculate outlook by pay
    const payRanges = [
        { max: 35000, label: '<$35K' },
        { max: 50000, label: '$35–50K' },
        { max: 75000, label: '$50–75K' },
        { max: 100000, label: '$75–100K' },
        { max: Infinity, label: '$100K+' }
    ];

    const payList = document.getElementById('pay-list');
    const payStats = calculateStatsByPay(data.occupations, payRanges);
    payList.innerHTML = payStats.map(s => `
        <div class="pay-item">
            <span class="pay-label">${s.label}</span>
            <span class="pay-outlook ${s.avgOutlook >= 0 ? 'positive' : 'negative'}">
                ${s.avgOutlook > 0 ? '+' : ''}${s.avgOutlook.toFixed(1)}%
            </span>
        </div>
    `).join('');

    // Calculate outlook by education
    const eduList = document.getElementById('edu-list');
    const eduStats = calculateStatsByEducation(data.occupations);
    eduList.innerHTML = eduStats.map(s => `
        <div class="edu-item">
            <span class="edu-label">${s.label}</span>
            <span class="edu-outlook ${s.avgOutlook >= 0 ? 'positive' : 'negative'}">
                ${s.avgOutlook > 0 ? '+' : ''}${s.avgOutlook.toFixed(1)}%
            </span>
        </div>
    `).join('');
}

/**
 * Calculate statistics by pay range
 */
function calculateStatsByPay(occupations, ranges) {
    const stats = [];
    let prevMax = 0;

    for (const range of ranges) {
        const inRange = occupations.filter(o => {
            if (range.max === Infinity) return o.median_pay >= 100000;
            return o.median_pay >= prevMax && o.median_pay < range.max;
        });

        const totalEmp = inRange.reduce((sum, o) => sum + o.employment, 0);
        const weightedOutlook = inRange.reduce((sum, o) => sum + o.outlook * o.employment, 0);
        const avgOutlook = totalEmp > 0 ? weightedOutlook / totalEmp : 0;

        stats.push({
            label: range.label,
            avgOutlook
        });

        prevMax = range.max === Infinity ? 100000 : range.max;
    }

    return stats;
}

/**
 * Calculate statistics by education level
 */
function calculateStatsByEducation(occupations) {
    const stats = [];

    for (let level = 1; level <= 5; level++) {
        const inLevel = occupations.filter(o => o.education_level === level);
        const totalEmp = inLevel.reduce((sum, o) => sum + o.employment, 0);
        const weightedOutlook = inLevel.reduce((sum, o) => sum + o.outlook * o.employment, 0);
        const avgOutlook = totalEmp > 0 ? weightedOutlook / totalEmp : 0;

        stats.push({
            label: EDUCATION_LABELS[level],
            avgOutlook
        });
    }

    return stats;
}

/**
 * Setup canvas size
 */
function setupCanvas() {
    const canvas = document.getElementById('treemap');
    const container = document.getElementById('visualization');

    canvas.width = container.clientWidth;
    canvas.height = Math.max(600, window.innerHeight - 300);
}

/**
 * Load data and initialize
 */
async function loadData() {
    try {
        // Handle both local and GitHub Pages paths
        const basePath = window.location.pathname.replace(/\/$/, '');
        const response = await fetch(basePath + '/data.json');
        data = await response.json();

        updateStats();
        updateLegend();
        drawTreemap();
    } catch (error) {
        console.error('Failed to load data:', error);
        document.querySelector('main').innerHTML =
            '<p class="error">Failed to load data. Please ensure data.json exists.</p>';
    }
}

/**
 * Initialize the app
 */
function init() {
    // Setup event listeners
    const canvas = document.getElementById('treemap');
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', hideTooltip);
    canvas.addEventListener('click', handleClick);

    document.querySelectorAll('.layer-btn').forEach(btn => {
        btn.addEventListener('click', handleLayerClick);
    });

    window.addEventListener('resize', () => {
        setupCanvas();
        drawTreemap();
    });

    // Setup and load
    setupCanvas();
    loadData();
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
