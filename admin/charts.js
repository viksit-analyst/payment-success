/**
 * charts.js — Mission Control
 * ---------------------------------------------------------------------------
 * Chart.js dataset/config builders, extracted out of mission-control.js so
 * the controller stays focused on routing and DOM wiring, not chart theming.
 * Namespaced under `window.AdminCharts`. Requires Chart.js (loaded via CDN
 * in admin/index.html) to already be on the page.
 *
 * Each build* function takes a <canvas> element and returns the created
 * Chart instance — mission-control.js is still responsible for destroying
 * old instances (state.chartInstances) and re-calling these on refresh.
 * ---------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  const AXIS_TICK_COLOR = 'rgba(248,250,252,0.42)';
  const AXIS_TICK_FONT_MONO = { family: 'IBM Plex Mono', size: 10 };
  const GRID_COLOR = 'rgba(255,255,255,0.06)';

  /** Shared line/bar axis + legend defaults. Doughnuts define their own
   * (they need a bottom legend, not hidden axes). */
  function lineBarDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: AXIS_TICK_COLOR, font: AXIS_TICK_FONT_MONO, maxTicksLimit: 7 } },
        y: { grid: { color: GRID_COLOR }, ticks: { color: AXIS_TICK_COLOR, font: AXIS_TICK_FONT_MONO } },
      },
    };
  }

  /**
   * Revenue over time (line, filled). `series = { labels: string[], revenue: number[] }`.
   */
  function buildRevenueChart(canvas, series) {
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: series.labels,
        datasets: [{
          data: series.revenue,
          borderColor: '#FF9933',
          backgroundColor: 'rgba(255,153,51,0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
        }],
      },
      options: lineBarDefaults(),
    });
  }

  /**
   * Strategy distribution (doughnut). `dist = { IVRV: n, GAMMA: n, VWAP: n }`
   * — colors follow the fixed VDS strategy palette, in insertion order.
   */
  function buildStrategyChart(canvas, dist) {
    return new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: Object.keys(dist),
        datasets: [{
          data: Object.values(dist),
          backgroundColor: ['#2E6BE6', '#FF9933', '#1FA971'],
          borderColor: '#0B1F3A',
          borderWidth: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: 'rgba(248,250,252,0.66)', font: { family: 'Inter', size: 11 }, padding: 14, usePointStyle: true, pointStyle: 'circle' },
          },
        },
      },
    });
  }

  /**
   * Customer growth (bar). `series = { labels: string[], customerGrowth: number[] }`.
   */
  function buildGrowthChart(canvas, series) {
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: series.labels,
        datasets: [{
          data: series.customerGrowth,
          backgroundColor: 'rgba(46,107,230,0.55)',
          borderRadius: 3,
          maxBarThickness: 10,
        }],
      },
      options: lineBarDefaults(),
    });
  }

  global.AdminCharts = { lineBarDefaults, buildRevenueChart, buildStrategyChart, buildGrowthChart };
})(window);
