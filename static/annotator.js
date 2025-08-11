document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const canvas = document.getElementById('annotatorCanvas');
    const ctx = canvas.getContext('2d');
    const fileListElem = document.getElementById('file-list');
    const saveBtn = document.getElementById('save-btn');
    const imageNameDisplay = document.getElementById('current-image-name');
    const propertiesForm = document.getElementById('properties-form');
    const fileInput = document.getElementById('file-input');

    // --- State Management ---
    let rois = [];
    let currentImage = null;
    let currentImageName = '';
    let isDrawing = false;
    let startX, startY;
    let currentRoi = {};
    let currentProperties = {};
    let localFileObjects = {}; // To store the File objects from the user's selection

    // --- Core Functions ---
    const resetState = () => {
        rois = [];
        currentImage = null;
        currentImageName = '';
        isDrawing = false;
        localFileObjects = {};
        imageNameDisplay.textContent = 'No image selected';
        fileListElem.innerHTML = '<li>Select a folder to begin.</li>';
        redraw();
    };

    const redraw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (currentImage) {
            canvas.width = currentImage.width;
            canvas.height = currentImage.height;
            ctx.drawImage(currentImage, 0, 0);
        } else {
            ctx.fillStyle = '#e9e9e9';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("Select an image from the list", canvas.width / 2, canvas.height / 2);
            return;
        }
        rois.forEach(roi => {
            ctx.strokeStyle = 'lime';
            ctx.lineWidth = 2;
            ctx.strokeRect(roi.x, roi.y, roi.w, roi.h);
            ctx.font = '16px Arial';
            ctx.fillStyle = 'lime';
            const label = roi.properties.Class || 'Untitled';
            ctx.fillText(label, roi.x, roi.y > 10 ? roi.y - 5 : roi.y + roi.h + 15);
        });
        if (isDrawing && currentRoi.w && currentRoi.h) {
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 2;
            ctx.strokeRect(currentRoi.x, currentRoi.y, currentRoi.w, currentRoi.h);
        }
    };

    const populatePropertiesPanel = async () => {
        try {
            const response = await fetch('/get_properties_config');
            const config = await response.json();
            propertiesForm.innerHTML = '';
            Object.keys(config).forEach(propName => {
                const options = config[propName];
                const group = document.createElement('div');
                group.className = 'property-group';
                const label = document.createElement('label');
                label.setAttribute('for', `prop-${propName}`);
                label.textContent = propName;
                const select = document.createElement('select');
                select.id = `prop-${propName}`;
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
        } catch (error) {
            propertiesForm.innerHTML = '<p>Could not load properties.</p>';
            console.error("Error populating properties:", error);
        }
    };

    // --- File and Annotation I/O ---
    fileInput.addEventListener('change', async (e) => {
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
            fileListElem.innerHTML = '<li>No supported images found in the selected directory.</li>';
            return;
        }

        const response = await fetch('/batch_annotation_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filenames: imageFiles }),
        });
        const annotationStatus = await response.json();

        fileListElem.innerHTML = '';
        imageFiles.forEach(name => {
            const li = document.createElement('li');
            const isAnnotated = annotationStatus[name];
            li.textContent = `${isAnnotated ? '✅' : '📄'} ${name}`;
            li.className = 'file-item';
            li.dataset.filename = name;
            li.addEventListener('click', () => switchImage(name));
            fileListElem.appendChild(li);
        });
    });

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
            const response = await fetch(`/annotations/${currentImageName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rois),
            });
            await response.json();
            console.log(`Annotations for ${currentImageName} saved.`);
            const fileItem = document.querySelector(`li[data-filename="${currentImageName}"]`);
            if (fileItem && !fileItem.textContent.startsWith('✅')) {
                fileItem.textContent = `✅ ${currentImageName}`;
            }
        } catch (error) {
            console.error('Error saving annotations:', error);
        }
    };

    // --- Canvas Event Handlers ---
    canvas.addEventListener('mousedown', e => {
        if (!currentImage) return;
        const rect = canvas.getBoundingClientRect();
        startX = (e.clientX - rect.left) * (canvas.width / rect.width);
        startY = (e.clientY - rect.top) * (canvas.height / rect.height);
        isDrawing = true;
    });

    canvas.addEventListener('mousemove', e => {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
        currentRoi = { x: Math.min(startX, mouseX), y: Math.min(startY, mouseY), w: Math.abs(mouseX - startX), h: Math.abs(mouseY - startY) };
        redraw();
    });

    canvas.addEventListener('mouseup', () => {
        if (!isDrawing) return;
        isDrawing = false;
        if (currentRoi.w > 5 && currentRoi.h > 5) {
            currentRoi.properties = { ...currentProperties };
            rois.push(currentRoi);
        }
        currentRoi = {};
        redraw();
    });

    canvas.addEventListener('contextmenu', e => {
        e.preventDefault();
        if (!currentImage) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
        const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
        let roiToDelete = -1;
        for (let i = rois.length - 1; i >= 0; i--) {
            const roi = rois[i];
            if (mouseX >= roi.x && mouseX <= roi.x + roi.w && mouseY >= roi.y && mouseY <= roi.y + roi.h) {
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

    // --- Initial Load ---
    saveBtn.addEventListener('click', () => {
        if (!currentImageName) {
            alert('Please select an image first.');
            return;
        }
        saveAnnotations().then(() => alert('Annotations saved!'));
    });

    populatePropertiesPanel();
    redraw(); // Initial draw for the empty canvas
});