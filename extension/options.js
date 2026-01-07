document.addEventListener("DOMContentLoaded", () => {
	const toggle = document.getElementById("demoToggle");
	const save = document.getElementById("save");

	if (!toggle || !save) return;

	chrome.storage.sync.get({ demoEnabled: false }, (items) => {
		toggle.checked = Boolean(items.demoEnabled);
	});

	save.addEventListener("click", () => {
		chrome.storage.sync.set({ demoEnabled: toggle.checked }, () => {
			console.log("Options saved");
		});
	});
});
