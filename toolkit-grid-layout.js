/* global window */
(function (global) {
  'use strict';

  var DEFAULT_CONFIG = {
    cols: 12,
    rowHeight: 30,
    margin: [24, 24],
    containerPadding: [0, 0],
  };

  function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
  }

  function collides(a, b) {
    if (a.i === b.i) return false;
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function calcColWidth(containerWidth, cols, margin, containerPadding) {
    var padX = (containerPadding && containerPadding[0]) || 0;
    return (containerWidth - margin[0] * (cols + 1) - padX * 2) / cols;
  }

  function calcPosition(item, config, containerWidth) {
    var cols = config.cols;
    var rowHeight = config.rowHeight;
    var margin = config.margin;
    var containerPadding = config.containerPadding || [0, 0];
    var colWidth = calcColWidth(containerWidth, cols, margin, containerPadding);
    var width = colWidth * item.w + Math.max(0, item.w - 1) * margin[0];
    var height = rowHeight * item.h + Math.max(0, item.h - 1) * margin[1];
    var left = containerPadding[0] + margin[0] + item.x * (colWidth + margin[0]);
    var top = containerPadding[1] + margin[1] + item.y * (rowHeight + margin[1]);
    return { left: left, top: top, width: width, height: height };
  }

  function calcContainerHeight(items, config) {
    if (!items || !items.length) return config.rowHeight + config.margin[1] * 2;
    var maxRow = 0;
    items.forEach(function (item) {
      maxRow = Math.max(maxRow, item.y + item.h);
    });
    var margin = config.margin;
    var rowHeight = config.rowHeight;
    var containerPadding = config.containerPadding || [0, 0];
    return containerPadding[1] * 2 + margin[1] + maxRow * rowHeight + Math.max(0, maxRow - 1) * margin[1] + margin[1];
  }

  function compactVertical(items, cols) {
    var sorted = items.slice().sort(function (a, b) {
      return a.y - b.y || a.x - b.x;
    });
    var out = [];
    sorted.forEach(function (item) {
      var newY = 0;
      while (true) {
        var test = { i: item.i, x: item.x, y: newY, w: item.w, h: item.h };
        var hit = out.some(function (other) { return collides(test, other); });
        if (!hit) break;
        newY += 1;
      }
      var next = Object.assign({}, item, { y: newY });
      out.push(next);
    });
    return out;
  }

  /** Keep each item's saved y when possible; only push down to resolve collisions. */
  function reflowPreserveLayout(items, cols) {
    var sorted = items.slice().sort(function (a, b) {
      return a.y - b.y || a.x - b.x;
    });
    var out = [];
    sorted.forEach(function (item) {
      var y = item.y;
      var guard = 0;
      while (guard < 500) {
        var test = { i: item.i, x: item.x, y: y, w: item.w, h: item.h };
        var pushY = -1;
        out.forEach(function (other) {
          if (collides(test, other)) {
            pushY = Math.max(pushY, other.y + other.h);
          }
        });
        if (pushY < 0) break;
        y = pushY;
        guard += 1;
      }
      out.push(Object.assign({}, item, { y: y }));
    });
    return out;
  }

  function getDropSlot(items, dragId, clientX, clientY, containerRect, config) {
    var dragItem = items.find(function (it) { return it.i === dragId; });
    if (!dragItem || !containerRect) return null;
    var cols = config.cols;
    var rowHeight = config.rowHeight;
    var margin = config.margin;
    var containerPadding = config.containerPadding || [0, 0];
    var containerWidth = containerRect.width;
    var colWidth = calcColWidth(containerWidth, cols, margin, containerPadding);
    var relX = clientX - containerRect.left;
    var relY = clientY - containerRect.top;
    var x = Math.round((relX - containerPadding[0] - margin[0]) / (colWidth + margin[0]));
    var y = Math.round((relY - containerPadding[1] - margin[1]) / (rowHeight + margin[1]));
    x = clamp(x, 0, cols - dragItem.w);
    y = Math.max(0, y);
    return { i: dragId, x: x, y: y, w: dragItem.w, h: dragItem.h };
  }

  function pixelsToGridItem(rect, containerRect, config) {
    var cols = config.cols;
    var rowHeight = config.rowHeight;
    var margin = config.margin;
    var containerPadding = config.containerPadding || [0, 0];
    var containerWidth = containerRect.width;
    var colWidth = calcColWidth(containerWidth, cols, margin, containerPadding);
    var relLeft = rect.left - containerRect.left;
    var relTop = rect.top - containerRect.top;
    var x = Math.round((relLeft - containerPadding[0] - margin[0]) / (colWidth + margin[0]));
    var y = Math.round((relTop - containerPadding[1] - margin[1]) / (rowHeight + margin[1]));
    var w = Math.max(1, Math.round((rect.width + margin[0]) / (colWidth + margin[0])));
    var h = Math.max(1, Math.round((rect.height + margin[1]) / (rowHeight + margin[1])));
    w = clamp(w, 1, cols);
    x = clamp(x, 0, Math.max(0, cols - w));
    y = Math.max(0, y);
    return { x: x, y: y, w: w, h: h };
  }

  function applyDropSlot(items, dragId, slot) {
    return items.map(function (item) {
      if (item.i === dragId) {
        return Object.assign({}, item, { x: slot.x, y: slot.y });
      }
      return Object.assign({}, item);
    });
  }

  function resizeItemGrid(items, itemId, newW, newH, cols) {
    return items.map(function (item) {
      if (item.i !== itemId) return Object.assign({}, item);
      return Object.assign({}, item, {
        w: clamp(newW, 1, cols),
        h: clamp(newH, 1, 24),
      });
    });
  }

  function pixelsDeltaToGrid(dw, dh, config, containerWidth) {
    var colWidth = calcColWidth(containerWidth, config.cols, config.margin, config.containerPadding);
    var dCols = Math.round(dw / (colWidth + config.margin[0]));
    var dRows = Math.round(dh / (config.rowHeight + config.margin[1]));
    return { dw: dCols, dh: dRows };
  }

  global.ToolkitGridLayout = {
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    clamp: clamp,
    collides: collides,
    calcColWidth: calcColWidth,
    calcPosition: calcPosition,
    calcContainerHeight: calcContainerHeight,
    compactVertical: compactVertical,
    reflowPreserveLayout: reflowPreserveLayout,
    getDropSlot: getDropSlot,
    pixelsToGridItem: pixelsToGridItem,
    applyDropSlot: applyDropSlot,
    resizeItemGrid: resizeItemGrid,
    pixelsDeltaToGrid: pixelsDeltaToGrid,
  };
})(typeof window !== 'undefined' ? window : globalThis);
