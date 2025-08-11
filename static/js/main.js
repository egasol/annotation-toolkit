// js/main.js
// The main entry point for the application.

import { initializeEventListeners } from './eventListeners.js';
import { populatePropertiesPanel } from './ui.js';
import { redraw } from './canvas.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('annotatorCanvas');
    const ctx = canvas.getContext('2d');
    const propertiesForm = document.getElementById('properties-form');

    // Initial setup
    populatePropertiesPanel(propertiesForm);
    initializeEventListeners();
    redraw(canvas, ctx);
});