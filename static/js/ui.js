// js/ui.js
// Handles DOM updates for UI panels like properties and the file list.

import { state } from './state.js';
import * as api from './api.js';

export function populatePropertiesPanel(propertiesForm, customConfig = null) {
    const processConfig = (config) => {
        state.propertyConfig = config;
        state.iconCache = {};
        propertiesForm.innerHTML = '';
        state.currentProperties = {};

        Object.keys(state.propertyConfig).forEach(propName => {
            state.propertyConfig[propName].forEach(option => {
                if (option.icon && !state.iconCache[option.icon]) {
                    const img = new Image();
                    img.src = `/static/icons/${option.icon}`;
                    state.iconCache[option.icon] = img;
                }
            });

            const options = state.propertyConfig[propName];
            const group = document.createElement('div');
            group.className = 'property-group';
            const label = document.createElement('label');
            label.textContent = propName;
            const select = document.createElement('select');
            select.dataset.propertyName = propName;
            options.forEach((option, index) => {
                const optElem = document.createElement('option');
                optElem.value = index;
                optElem.textContent = option.name;
                select.appendChild(optElem);
            });
            group.appendChild(label);
            group.appendChild(select);
            propertiesForm.appendChild(group);
            state.currentProperties[propName] = options.length > 0 ? options[0] : {};

            select.addEventListener('change', (e) => {
                const selectedIndex = e.target.value;
                state.currentProperties[e.target.dataset.propertyName] = options[selectedIndex];
            });
        });
    };

    if (customConfig) {
        processConfig(customConfig);
    } else {
        api.fetchPropertiesConfig()
            .then(processConfig)
            .catch(error => {
                propertiesForm.innerHTML = '<p>Could not load default properties.</p>';
                console.error("Error loading default properties:", error);
            });
    }
}

export async function updateAnnotationStatus() {
    const filenames = Object.keys(state.localFileObjects);
    const annotationStatus = await api.fetchAnnotationStatus(filenames);
    
    document.querySelectorAll('#file-list .file-item').forEach(li => {
        const name = li.dataset.filename;
        const status = annotationStatus[name];
        let icon;
        switch (status) {
            case 'annotated': icon = '✅'; break;
            case 'empty': icon = '🟡'; break;
            default: icon = '📄';
        }
        li.textContent = `${icon} ${name}`;
    });
}