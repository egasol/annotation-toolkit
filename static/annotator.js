document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const canvas = document.getElementById('annotatorCanvas');
    const ctx = canvas.getContext('2d');
    const resetViewBtn = document.getElementById('reset-view-btn');
    const fileListElem = document.getElementById('file-list');
    const saveBtn = document.getElementById('save-btn');
    const imageNameDisplay = document.getElementById('current-image-name');
    const propertiesForm = document.getElementById('properties-form');
    const imageFolderInput = document.getElementById('file-input');
    const propsFileInput = document.getElementById('props-input');
    const annotDirInput = document.getElementById('annot-dir-input');
    const setAnnotDirBtn = document.getElementById('set-annot-dir-btn');

    // --- State Management ---
    let rois = [];
    let currentImage = null;
    let currentImageName = '';
    let isDrawing = false;
    let startX, startY;
    let currentRoi = {};
    let currentProperties = {};
    let localFileObjects = {};

    // --- View Transform State ---
    let scale = 1.0;
    let originX = 0;
    let originY = 0;
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    const MIN_SCALE = 0.1;
    const MAX_SCALE = 10;

    // --- Helper Functions ---

    const getMousePos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        return {
            x: (canvasX / scale) + originX,
            y: (canvasY / scale) + originY,
        };
    };

    const zoomToFit = (imageWidth, imageHeight) => {
        const canvasWidth = canvas.clientWidth;
        const canvasHeight = canvas.clientHeight;
        const scaleX = canvasWidth / imageWidth;
        const scaleY = canvasHeight / imageHeight;
        scale = Math.min(scaleX, scaleY);
        originX = (imageWidth - canvasWidth / scale) / 2;
        originY = (imageHeight - canvasHeight / scale) / 2;
    };

    const resetState = () => {
        rois = [];
        currentImage = null;
        currentImageName = '';
        isDrawing = false;
        localFileObjects = {};
        imageNameDisplay.textContent = 'No image selected';
        fileListElem.innerHTML = '<li>Select a folder to begin.</li>';
        scale = 1.0;
        originX = 0;
        originY = 0;
        redraw();
    };

    const redraw = () => {
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        ctx.save();
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = '#e9e9e9';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.translate(-originX * scale, -originY * scale);
        ctx.scale(scale, scale);
        if (currentImage) {
            ctx.imageSmoothingEnabled = scale < 1;
            ctx.drawImage(currentImage, 0, 0);
        } else {
            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '20px Arial';
            const worldCenterX = (canvasWidth / 2) / scale + originX;
            const worldCenterY = (canvasHeight / 2) / scale + originY;
            ctx.fillText("Select an image to begin", worldCenterX, worldCenterY);
        }
        rois.forEach(roi => {
            ctx.strokeStyle = 'lime';
            ctx.lineWidth = 2 / scale;
            ctx.strokeRect(roi.x, roi.y, roi.w, roi.h);
            ctx.font = `${16 / scale}px Arial`;
            ctx.fillStyle = 'lime';
            const label = roi.properties.Class || 'Untitled';
            ctx.fillText(label, roi.x, roi.y > 10 / scale ? roi.y - 5 / scale : roi.y + roi.h + 15 / scale);
        });
        if (isDrawing && currentRoi.w && currentRoi.h) {
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 2 / scale;
            ctx.strokeRect(currentRoi.x, currentRoi.y, currentRoi.w, currentRoi.h);
        }
        ctx.restore();
    };

    const populatePropertiesPanel = (customConfig = null) => {
        const processConfig = (config) => {
            propertiesForm.innerHTML = '';
            currentProperties = {};
            Object.keys(config).forEach(propName => {
                const options = config[propName];
                const group = document.createElement('div');
                group.className = 'property-group';
                const label = document.createElement('label');
                label.textContent = propName;
                const select = document.createElement('select');
                select.dataset.propertyName = propName;
                options.forEach(optionValue => {
                    const option = document.createElement('option');
                    option.value = optionValue;
                    option.textContent = optionValue;
                    select.appendChild(option);
                });
                group.appendChild(label);
                group.appendChild(select);
                propertiesForm.appendChild(group);
                currentProperties[propName] = select.value;
                select.addEventListener('change', (e) => {
                    currentProperties[e.target.dataset.propertyName] = e.target.value;
                });
            });
        };
        if (customConfig) {
            processConfig(customConfig);
        } else {
            fetch('/get_properties_config')
                .then(response => response.json())
                .then(processConfig)
                .catch(error => {
                    propertiesForm.innerHTML = '<p>Could not load default properties.</p>';
                    console.error("Error loading default properties:", error);
                });
        }
    };

    const updateAnnotationStatus = async () => {
        const filenames = Object.keys(localFileObjects);
        if (filenames.length === 0) return;
        const response = await fetch('/batch_annotation_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames }),
        });
        const annotationStatus = await response.json();

        document.querySelectorAll('#file-list .file-item').forEach(li => {
            const name = li.dataset.filename;
            const status = annotationStatus[name];
            let icon;
            switch (status) {
                case 'annotated':
                    icon = '✅';
                    break;
                case 'empty':
                    icon = '🟡';
                    break;
                default:
                    icon = '📄';
            }
            li.textContent = `${icon} ${name}`;
        });
    };

    const switchImage = async (filename) => {
        if (currentImageName && currentImageName !== filename) {
            await saveAnnotations();
        }
        rois = [];
        currentImageName = filename;
        document.querySelectorAll('#file-list .file-item').forEach(item => {
            item.classList.toggle('active', item.dataset.filename === filename);
        });
        imageNameDisplay.textContent = `Annotating: ${filename}`;
        const file = localFileObjects[filename];
        const localUrl = URL.createObjectURL(file);
        const img = new Image();
        img.src = localUrl;
        img.onload = () => {
            currentImage = img;
            zoomToFit(img.width, img.height);
            loadAnnotations(filename);
            URL.revokeObjectURL(localUrl);
        };
        img.onerror = () => { alert(`Failed to load image: ${filename}`); };
    };

    const loadAnnotations = async (filename) => {
        try {
            const response = await fetch(`/annotations/${filename}`);
            rois = response.ok ? await response.json() : [];
        } catch (error) {
            console.error('Could not load annotations:', error);
            rois = [];
        }
        redraw();
    };

    const saveAnnotations = async () => {
        if (!currentImageName) return;
        try {
            await fetch(`/annotations/${currentImageName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rois),
            });
            console.log(`Annotations for ${currentImageName} saved.`);
            await updateAnnotationStatus();
        } catch (error) {
            console.error('Error saving annotations:', error);
        }
    };

    // --- Event Listeners ---

    imageFolderInput.addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;
        resetState();
        const supportedFormats = ['image/jpeg', 'image/png', 'image/gif'];
        let imageFiles = [];
        for (const file of e.target.files) {
            if (supportedFormats.includes(file.type)) {
                localFileObjects[file.name] = file;
                imageFiles.push(file.name);
            }
        }
        imageFiles.sort();
        if (imageFiles.length === 0) {
            fileListElem.innerHTML = '<li>No supported images found.</li>';
            return;
        }
        fileListElem.innerHTML = '';
        imageFiles.forEach(name => {
            const li = document.createElement('li');
            li.textContent = `📄 ${name}`;
            li.className = 'file-item';
            li.dataset.filename = name;
            li.addEventListener('click', () => switchImage(name));
            fileListElem.appendChild(li);
        });
        await updateAnnotationStatus();
    });

    propsFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const newConfig = JSON.parse(event.target.result);
                populatePropertiesPanel(newConfig);
                alert('Successfully loaded new properties file.');
            } catch (error) {
                alert('Failed to parse JSON from properties file.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    setAnnotDirBtn.addEventListener('click', async () => {
        const path = annotDirInput.value.trim();
        if (!path) {
            alert("Please enter a folder path.");
            return;
        }
        try {
            const response = await fetch('/set_annotation_dir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: path }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.description || 'Failed to set directory.');
            }
            alert(`Annotation directory set to:\n${path}`);
            await updateAnnotationStatus();
        } catch (error) {
            alert(`Error setting directory: ${error.message}`);
        }
    });

    saveBtn.addEventListener('click', () => {
        if (!currentImageName) {
            alert('Please select an image first.');
            return;
        }
        saveAnnotations().then(() => alert('Annotations saved!'));
    });

    resetViewBtn.addEventListener('click', () => {
        if (!currentImage) return;
        zoomToFit(currentImage.width, currentImage.height);
        redraw();
    });

    canvas.addEventListener('mousedown', e => {
        if (!currentImage) return;
        if (e.button === 1) { // Middle mouse button
            e.preventDefault();
            isPanning = true;
            panStart.x = e.clientX;
            panStart.y = e.clientY;
            canvas.classList.add('panning');
        } else if (e.button === 0) { // Left mouse button
            const pos = getMousePos(e);
            startX = pos.x;
            startY = pos.y;
            isDrawing = true;
        }
    });

    canvas.addEventListener('mousemove', e => {
        if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            panStart.x = e.clientX;
            panStart.y = e.clientY;
            originX -= dx / scale;
            originY -= dy / scale;
            redraw();
        } else if (isDrawing) {
            const pos = getMousePos(e);
            currentRoi = {
                x: Math.min(startX, pos.x),
                y: Math.min(startY, pos.y),
                w: Math.abs(pos.x - startX),
                h: Math.abs(pos.y - startY),
            };
            redraw();
        }
    });

    canvas.addEventListener('mouseup', e => {
        if (isPanning) {
            isPanning = false;
            canvas.classList.remove('panning');
        }
        if (isDrawing) {
            isDrawing = false;
            if (currentRoi.w > 5 / scale && currentRoi.h > 5 / scale) {
                currentRoi.properties = { ...currentProperties };
                rois.push(currentRoi);
            }
            currentRoi = {};
            redraw();
        }
    });

    canvas.addEventListener('contextmenu', e => {
        e.preventDefault();
        if (!currentImage) return;
        const pos = getMousePos(e);
        let roiToDelete = -1;
        for (let i = rois.length - 1; i >= 0; i--) {
            const roi = rois[i];
            if (pos.x >= roi.x && pos.x <= roi.x + roi.w && pos.y >= roi.y && pos.y <= roi.y + roi.h) {
                roiToDelete = i;
                break;
            }
        }
        if (roiToDelete !== -1) {
            if (confirm(`Delete ROI "${rois[roiToDelete].properties.Class}"?`)) {
                rois.splice(roiToDelete, 1);
                redraw();
            }
        }
    });

    canvas.addEventListener('wheel', e => {
        if (!currentImage) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const worldX = (canvasX / scale) + originX;
        const worldY = (canvasY / scale) + originY;
        const zoom = e.deltaY < 0 ? 1.1 : 0.9;
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * zoom));
        const newOriginX = worldX - (canvasX / newScale);
        const newOriginY = worldY - (canvasY / newScale);
        scale = newScale;
        originX = newOriginX;
        originY = newOriginY;
        redraw();
    });

    // --- Initial Load ---
    populatePropertiesPanel();
    redraw();
});