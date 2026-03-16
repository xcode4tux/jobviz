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
            { stop: 0, color: [200, 40, 40] },      // Bright Red
            { stop: 0.35, color: [170, 80, 40] },   // Orange/Brown
            { stop: 0.5, color: [140, 120, 50] },   // Yellow/Olive
            { stop: 0.7, color: [70, 140, 50] },    // Light Green
            { stop: 1, color: [30, 180, 40] }       // Bright Green
        ],
        format: v => `${v > 0 ? '+' : ''}${v}%`
    },
    pay: {
        min: 25000,
        max: 180000,
        colors: [
            { stop: 0, color: [20, 40, 60] },       // Very dark blue
            { stop: 0.33, color: [30, 80, 120] },   // Dark blue
            { stop: 0.66, color: [40, 120, 180] },  // Medium blue
            { stop: 1, color: [50, 160, 240] }      // Vibrant blue
        ],
        format: v => `$${Math.round(v / 1000)}k`
    },
    education: {
        levels: [
            { level: 0, color: [60, 60, 60], label: 'N/A' },
            { level: 1, color: [70, 90, 110], label: 'No degree/HS' },
            { level: 2, color: [90, 110, 90], label: 'Postsec/Assoc' },
            { level: 3, color: [80, 120, 80], label: "Bachelor's" },
            { level: 4, color: [120, 130, 70], label: "Master's" },
            { level: 5, color: [140, 100, 60], label: 'Doctoral/Prof' }
        ],
        format: (v, edu) => edu || 'N/A'
    },
    'ai-exposure': {
        min: 0,
        max: 10,
        colors: [
            { stop: 0, color: [40, 40, 40] },
            { stop: 0.25, color: [70, 40, 90] },
            { stop: 0.5, color: [110, 50, 140] },
            { stop: 0.75, color: [160, 60, 190] },
            { stop: 1, color: [220, 70, 240] }
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
 * Squarified treemap layout algorithm.
 * Uses employment as area, normalized to the available rectangle.
 */
function squarify(children, x, y, width, height, result) {
    if (!children.length || width <= 0 || height <= 0) return;

    // Normalize employment to pixel areas
    const totalEmployment = children.reduce((sum, c) => sum + Math.max(0, c.employment || 0), 0);
    if (!totalEmployment) return;

    const totalArea = width * height;
    const nodes = children
        .map(c => ({
            ...c,
            area: (Math.max(0, c.employment || 0) / totalEmployment) * totalArea
        }))
        .sort((a, b) => b.area - a.area); // largest first

    const rect = { x, y, width, height };
    let row = [];

    function worstAspect(rowNodes, w) {
        if (!rowNodes.length) return Infinity;
        const areas = rowNodes.map(n => n.area);
        const sum = areas.reduce((a, v) => a + v, 0);
        const sumSq = sum * sum;
        const minA = Math.min(...areas);
        const maxA = Math.max(...areas);
        return Math.max((w * w * maxA) / sumSq, sumSq / (w * w * minA));
    }

    function layoutRow(rowNodes, rectObj, horizontal) {
        const rowArea = rowNodes.reduce((a, n) => a + n.area, 0);
        if (rowArea <= 0) return;

        if (horizontal) {
            const rowHeight = rowArea / rectObj.width;
            let cx = rectObj.x;
            for (const n of rowNodes) {
                const w = n.area / rowHeight;
                result.push({
                    ...n,
                    x: cx,
                    y: rectObj.y,
                    width: w,
                    height: rowHeight
                });
                cx += w;
            }
            rectObj.y += rowHeight;
            rectObj.height -= rowHeight;
        } else {
            const rowWidth = rowArea / rectObj.height;
            let cy = rectObj.y;
            for (const n of rowNodes) {
                const h = n.area / rowWidth;
                result.push({
                    ...n,
                    x: rectObj.x,
                    y: cy,
                    width: rowWidth,
                    height: h
                });
                cy += h;
            }
            rectObj.x += rowWidth;
            rectObj.width -= rowWidth;
        }
    }

    let remaining = nodes.slice();
    let horizontal = width >= height;

    while (remaining.length) {
        const node = remaining[0];
        const testRow = row.concat(node);
        const side = horizontal ? rect.width : rect.height;

        if (row.length && worstAspect(testRow, side) > worstAspect(row, side)) {
            layoutRow(row, rect, horizontal);
            horizontal = rect.width >= rect.height;
            row = [];
        } else {
            row = testRow;
            remaining.shift();
        }
    }

    if (row.length) {
        layoutRow(row, rect, horizontal);
    }
}

/**
 * Build treemap layout
 */
function buildTreemap(occupations) {
    const layout = [];
    const canvas = document.getElementById('treemap');
    const rect = canvas.getBoundingClientRect();
    const padding = 1;

    // Group by category
    const categories = {};
    for (const occ of occupations) {
        if (!categories[occ.category]) {
            categories[occ.category] = {
                title: occ.category,
                employment: 0,
                children: []
            };
        }
        categories[occ.category].employment += Math.max(0, occ.employment || 0);
        categories[occ.category].children.push(occ);
    }

    const categoryNodes = Object.values(categories).sort((a, b) => b.employment - a.employment);
    const categoryLayout = [];

    // 1. Layout the categories
    squarify(
        categoryNodes,
        padding,
        padding,
        rect.width - padding,
        rect.height - padding,
        categoryLayout
    );

    // 2. Layout the children within each category
    for (const cat of categoryLayout) {
        // We use a small internal padding to distinguish category boundaries (2px gap between categories)
        const innerPadding = 2;
        squarify(
            cat.children,
            cat.x + innerPadding,
            cat.y + innerPadding,
            cat.width - innerPadding * 2,
            cat.height - innerPadding * 2,
            layout
        );
    }

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

        // Draw labels if space allows
        if (tile.width > 80 && tile.height > 26) {
            // Choose text color based on tile brightness
            const luminance = (0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2]) / 255;
            const textColor = luminance > 0.6 ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.9)';

            ctx.fillStyle = textColor;
            ctx.font = '11px system-ui, sans-serif';
            const maxTextWidth = tile.width - 8;

            const title = truncateText(tile.title, maxTextWidth);
            ctx.fillText(title, tile.x + 4, tile.y + 13);

            // Second line: employment + outlook (reference-style)
            const secondary = `${formatNumber(tile.employment)} • ${formatValue(tile.outlook, 'outlook')}`;
            const secondaryText = truncateText(secondary, maxTextWidth);
            ctx.font = '10px system-ui, sans-serif';
            ctx.fillText(secondaryText, tile.x + 4, tile.y + 24);
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

    const width = container.clientWidth;
    const height = Math.round(width * 0.62); // similar aspect ratio to reference

    canvas.width = width;
    canvas.height = height;
}

/**
 * Load data and initialize
 */
async function loadData() {
    try {
        // Fetch data.json relative to the current page (works for /, /index.html, and /jobviz/index.html)
        const response = await fetch('data.json');
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
