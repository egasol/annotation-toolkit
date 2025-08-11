// js/api.js
// Manages all fetch calls to the server backend.

export async function fetchPropertiesConfig() {
    const response = await fetch('/get_properties_config');
    return response.json();
}

export async function fetchAnnotationStatus(filenames) {
    if (filenames.length === 0) return {};
    const response = await fetch('/batch_annotation_status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames }),
    });
    return response.json();
}

export async function loadAnnotations(filename) {
    try {
        const response = await fetch(`/annotations/${filename}`);
        return response.ok ? await response.json() : [];
    } catch (error) {
        console.error('Could not load annotations:', error);
        return [];
    }
}

export async function saveAnnotations(filename, rois) {
    try {
        await fetch(`/annotations/${filename}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rois),
        });
        console.log(`Annotations for ${filename} saved.`);
    } catch (error) {
        console.error('Error saving annotations:', error);
    }
}

export async function setAnnotationDirectory(path) {
    const response = await fetch('/set_annotation_dir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.description || 'Failed to set directory.');
    }
    return response.json();
}