/*
 * Workspace Screen Filler for Plasma 6.x
 *
 * Config keys in kwinrc:
 * - ForceUnmaximizeOnOpen (bool, default: true)
 * - IgnoredApps (comma-separated list, default: "")
 * - PrimaryOutputName (string, default: "")
 */

const FORCE_UNMAXIMIZE_ON_OPEN = readConfig("ForceUnmaximizeOnOpen", true);
const PRIMARY_OUTPUT_NAME = String(readConfig("PrimaryOutputName", "")).trim();
const IGNORED_APPS = parseIgnoredApps(readConfig("IgnoredApps", ""));

const placementGuard = {};

function parseIgnoredApps(value) {
	const s = String(value || "").trim();
	if (!s) {
		return {};
	}

	const set = {};
	const parts = s.split(",");
	for (let i = 0; i < parts.length; i++) {
		const key = parts[i].trim().toLowerCase();
		if (key) {
			set[key] = true;
		}
	}
	return set;
}

function hasIgnoredApps() {
	for (const key in IGNORED_APPS) {
		if (Object.prototype.hasOwnProperty.call(IGNORED_APPS, key)) {
			return true;
		}
	}
	return false;
}

function windowIdentityKeys(window) {
	const keys = [];
	if (window.desktopFileName) {
		keys.push(String(window.desktopFileName).toLowerCase());
	}
	if (window.resourceClass) {
		keys.push(String(window.resourceClass).toLowerCase());
	}
	if (window.resourceName) {
		keys.push(String(window.resourceName).toLowerCase());
	}
	return keys;
}

function isIgnoredWindow(window) {
	if (!window || !hasIgnoredApps()) {
		return false;
	}

	const keys = windowIdentityKeys(window);
	for (let i = 0; i < keys.length; i++) {
		if (IGNORED_APPS[keys[i]]) {
			return true;
		}
	}
	return false;
}

function isManagedNormalWindow(window) {
	if (!window) {
		return false;
	}
	if (!window.managed || window.deleted) {
		return false;
	}
	if (!window.normalWindow || window.specialWindow) {
		return false;
	}
	if (window.popupWindow || window.onScreenDisplay || window.notification) {
		return false;
	}
	return true;
}

function windowsOnDesktop(window, desktop) {
	if (!window || !desktop) {
		return false;
	}
	if (window.onAllDesktops) {
		return true;
	}

	const ds = window.desktops || [];
	for (let i = 0; i < ds.length; i++) {
		if (ds[i] === desktop) {
			return true;
		}
	}
	return false;
}

function currentOrFirstDesktop(window) {
	if (window && !window.onAllDesktops) {
		const ds = window.desktops || [];
		if (ds.length > 0) {
			return ds[0];
		}
	}
	return workspace.currentDesktop;
}

function choosePrimaryAndSecondaryOutputs() {
    const outputs = workspace.screens || [];
    if (outputs.length === 0) {
        return { primary: null, secondary: null };
    }

    let primary = null;
    if (PRIMARY_OUTPUT_NAME) {
        for (let i = 0; i < outputs.length; i++) {
            if (outputs[i].name === PRIMARY_OUTPUT_NAME) {
                primary = outputs[i];
                break;
            }
        }
    }
    if (!primary) {
        primary = outputs[0];
    }

    let secondary = null;
    for (let i = 0; i < outputs.length; i++) {
        if (outputs[i] !== primary) {
            secondary = outputs[i];
            break;
        }
    }

    return { primary: primary, secondary: secondary };
}

function approxEqual(a, b) {
	return Math.abs(a - b) <= 2;
}

function isWindowMaximizedOn(window, desktop, output) {
	if (!window || !desktop || !output) {
		return false;
	}
	if (window.minimized || window.deleted) {
		return false;
	}

	const g = window.frameGeometry;
	const area = workspace.clientArea(KWin.MaximizeArea, output, desktop);
	return approxEqual(g.x, area.x)
		&& approxEqual(g.y, area.y)
		&& approxEqual(g.width, area.width)
		&& approxEqual(g.height, area.height);
}

function isScreenOccupied(desktop, output, exceptWindow) {
	const windows = workspace.stackingOrder || [];
	for (let i = 0; i < windows.length; i++) {
		const w = windows[i];
		if (w === exceptWindow) {
			continue;
		}
		if (!isManagedNormalWindow(w)) {
			continue;
		}
		if (!windowsOnDesktop(w, desktop)) {
			continue;
		}
		if (w.output !== output) {
			continue;
		}
		if (isWindowMaximizedOn(w, desktop, output)) {
			return true;
		}
	}
	return false;
}

function desktopIndex(desktop) {
	const desktops = workspace.desktops || [];
	for (let i = 0; i < desktops.length; i++) {
		if (desktops[i] === desktop) {
			return i;
		}
	}
	return -1;
}

function findPlacement(exceptWindow, primary, secondary) {
    const desktops = workspace.desktops || [];
    if (desktops.length === 0 || !primary) {
        return null;
    }

    const current = workspace.currentDesktop;
    let start = desktopIndex(current);
    if (start < 0) {
        start = 0;
    }

    for (let i = start; i < desktops.length; i++) {
        const d = desktops[i];

        // Single-screen mode: only primary matters.
        if (!isScreenOccupied(d, primary, exceptWindow)) {
            return { desktop: d, output: primary };
        }

        // Two-screen mode: try secondary in same desktop.
        if (secondary && !isScreenOccupied(d, secondary, exceptWindow)) {
            return { desktop: d, output: secondary };
        }
    }

    const oldCount = desktops.length;
    workspace.createDesktop(oldCount, "Desktop" + (oldCount + 1));
    const updated = workspace.desktops || [];
    if (updated.length > oldCount) {
        return { desktop: updated[updated.length - 1], output: primary };
    }

    return { desktop: workspace.currentDesktop, output: primary };
}

function placeMaximizedWindow(window) {
    if (!isManagedNormalWindow(window) || isIgnoredWindow(window)) {
        return;
    }

    const outputs = choosePrimaryAndSecondaryOutputs();
    if (!outputs.primary) {
        return;
    }

    const target = findPlacement(window, outputs.primary, outputs.secondary);
    if (!target) {
        return;
    }

    window.desktops = [target.desktop];
    workspace.currentDesktop = target.desktop;
    workspace.sendClientToScreen(window, target.output);
    window.setMaximize(true, true);
}

function windowKey(window) {
	if (!window) {
		return "";
	}
	return String(window.internalId || window.caption || "");
}

function onWindowMaximizedChanged(window) {
	if (!isManagedNormalWindow(window) || isIgnoredWindow(window)) {
		return;
	}

	const key = windowKey(window);
	if (!key) {
		return;
	}
	if (placementGuard[key]) {
		return;
	}

	const d = currentOrFirstDesktop(window);
	const out = window.output;
	if (!isWindowMaximizedOn(window, d, out)) {
		return;
	}

	placementGuard[key] = true;
	try {
		placeMaximizedWindow(window);
	} finally {
		placementGuard[key] = false;
	}
}

function trackWindow(window) {
	if (!window || !window.maximizedChanged) {
		return;
	}
	window.maximizedChanged.connect(function() {
		onWindowMaximizedChanged(window);
	});
}

function onWindowAdded(window) {
	if (!isManagedNormalWindow(window)) {
		return;
	}

	trackWindow(window);

	if (FORCE_UNMAXIMIZE_ON_OPEN && !isIgnoredWindow(window)) {
		window.setMaximize(false, false);
	}
}

function init() {
	workspace.windowAdded.connect(onWindowAdded);

	const windows = workspace.stackingOrder || [];
	for (let i = 0; i < windows.length; i++) {
		trackWindow(windows[i]);
	}
}

init();
