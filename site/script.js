// Farbtonsuche
// mittels "fuse.js" (fuzzy search)

const searchInput = document.getElementById("search");
const resultsContainer = document.getElementById("results");
const clearBtn = document.getElementById("clear-btn");
const colorsystemFilter = document.getElementById("colorsystem-filter");

let fuses = []; // Array to hold Fuse.js instances
let colorsystems = []; // Array to hold color system names

// Function to strip comments from JSON
function stripJsonComments(jsonString) {
	return jsonString.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim();
}

// Function to normalize text for better search matching
function normalizeText(text) {
	if (!text) return text;
	return text
		.normalize("NFD") // Decompose characters (é becomes e + ´)
		.replace(/[\u0300-\u036f]/g, '') // Remove all diacritics/accents
		.replace(/ß/g, 'ss') // German: Replace ß with ss
		.replace(/æ/gi, 'ae') // Replace æ with ae
		.replace(/œ/gi, 'oe') // Replace œ with oe
		.replace(/ð/gi, 'd') // Replace ð with d
		.replace(/þ/gi, 'th') // Replace þ with th
		.toLowerCase();
}

// Combine files
const files = [
	"caparol_3dsystem_plus.json",
	"db.json",
	"farrow-ball.json",
	"les-couleurs.json",
	"little-greene.json",
	"ncs.json",
	"pantone.json",
	"ral-classic.json",
];

// Load colors and initialize Fuse.js instances
Promise.all(files.map(file =>
	fetch(file)
		.then(response => response.text())
		.then(text => JSON.parse(stripJsonComments(text)))
)).then(dataArrays => {
	// Create a Fuse.js instance for each data array
	dataArrays.forEach(dataArray => {
		const colorsystemName = dataArray.colorsystem.name;
		colorsystems.push(colorsystemName); // Store color system names
		const colors = dataArray.colorsystem.colors.map(color => ({
			...color,
			colorsystem: { name: colorsystemName },
			// Add normalized versions for searching
			normalizedId: normalizeText(color.id),
			normalizedVanityname: color.vanityname ? normalizeText(color.vanityname) : ''
		})); // Extract colors array and include colorsystem name
		const options = {
			keys: ["id", "vanityname", "normalizedId", "normalizedVanityname"], // Include normalized fields
			threshold: 0.2, // Adjust for fuzziness
			includeMatches: true, // Include match information for highlighting
			useExtendedSearch: true, // Enable extended search to handle diacritics
		};
		fuses.push(new Fuse(colors, options));
	});
	// Populate the dropdown with color systems
	populateColorsystemDropdown();
	//console.log("Fuse instances:", fuses); // Debugging log
}).catch(error => {
	console.error("Oopsie! Error fetching colors:", error);
});

// Populate the color system dropdown
function populateColorsystemDropdown() {
	colorsystems.forEach(system => {
		const option = document.createElement("option");
		option.value = system;
		option.textContent = system;
		colorsystemFilter.appendChild(option);
	});
}

// Filter and display results
function performSearch() {
	const query = searchInput.value.normalize("NFC"); // Normalize input
	const normalizedQuery = normalizeText(query); // Normalize for better matching
	const selectedSystem = colorsystemFilter.value;
	let results = [];

	// Search each Fuse.js instance and combine results
	fuses.forEach((fuse, index) => {
		// If a specific color system is selected, only search/show that system
		if (!selectedSystem || colorsystems[index] === selectedSystem) {
			if (query) {
				// Search with both original and normalized query
				const originalResults = fuse.search(query);
				const normalizedResults = fuse.search(normalizedQuery);

				// Combine and deduplicate results
				const combinedResults = [...originalResults];
				normalizedResults.forEach(result => {
					if (!combinedResults.find(r => r.item.id === result.item.id)) {
						combinedResults.push(result);
					}
				});

				results = results.concat(combinedResults);
			} else if (selectedSystem) {
				// If no query but a color system is selected, show all colors from that system
				const allColors = fuse.getIndex().docs;
				results = results.concat(allColors.map(item => ({ item })));
			}
		}
	});
	//console.log("Search results:", results); // Debugging log

	// Show the clear button if there's text
	clearBtn.style.display = query ? "inline" : "none";

	// Render results with highlights
	displayResults(results, query);
}

// Filter and display results
searchInput.addEventListener("input", performSearch);

// Filter results when dropdown changes
colorsystemFilter.addEventListener("change", performSearch);

// Clear the search input and results when the clear button is clicked
clearBtn.addEventListener("click", () => {
	searchInput.value = "";
	colorsystemFilter.value = ""; // Reset dropdown
	clearBtn.style.display = "none";
	resultsContainer.innerHTML = ""; // Clear results
});

function displayResults(results, query) {
	resultsContainer.innerHTML = results
		.map(result => {
			const { item, matches } = result;

			// Highlight fields
			const cs = item.colorsystem.name;
			const id = highlightMatch(item.id, matches, "id");
			const name = item.vanityname ? highlightMatch(item.vanityname, matches, "vanityname") : "";
			const colorHex = item.hex;

			return `<li>
						<div>
							<h2><span class="color">${id}</span> ${name}</h2>
							<p>${cs}</p>
						</div>
						<div>
							<div class="colorbox" style="background-color: #${colorHex};" onclick="copyToClipboard('${colorHex}')"></div>
							<p>#${colorHex}</p>
						</div>
					</li>`;
		})
		.join("");
}

function highlightMatch(text, matches, key) {
	if (!matches) return text;

	// Check for matches in both original and normalized fields
	const match = matches.find(m => m.key === key);
	const normalizedMatch = matches.find(m => m.key === `normalized${key.charAt(0).toUpperCase() + key.slice(1)}`);

	if (!match && !normalizedMatch) return text;

	let highlightedText = text;

	// If we have a direct match, use it
	if (match) {
		match.indices
			.reverse()
			.forEach(([start, end]) => {
				if (end - start >= 1) {
					highlightedText =
						highlightedText.slice(0, start) +
						`<span class="highlight">${highlightedText.slice(start, end + 1)}</span>` +
						highlightedText.slice(end + 1);
				}
			});
	}
	// If we only have a normalized match, we need to find the corresponding position in the original text
	else if (normalizedMatch) {
		const normalizedText = normalizeText(text);
		normalizedMatch.indices
			.reverse()
			.forEach(([start, end]) => {
				if (end - start >= 1) {
					// Find the corresponding position in the original text
					// This is a simple approach that works for most cases
					let originalStart = start;
					let originalEnd = end;

					// Adjust for cases where normalization changed character count
					// Count actual characters up to the match position
					let normalPos = 0;
					let originalPos = 0;

					while (normalPos < start && originalPos < text.length) {
						const originalChar = text[originalPos];
						const normalizedChar = normalizeText(originalChar);

						if (normalizedChar.length > 0) {
							normalPos += normalizedChar.length;
						}
						originalPos++;
					}
					originalStart = originalPos - 1;

					// Find the end position
					while (normalPos <= end && originalPos < text.length) {
						const originalChar = text[originalPos];
						const normalizedChar = normalizeText(originalChar);

						if (normalizedChar.length > 0) {
							normalPos += normalizedChar.length;
						}
						originalPos++;
					}
					originalEnd = originalPos - 1;

					// Ensure we don't go out of bounds
					originalStart = Math.max(0, originalStart);
					originalEnd = Math.min(text.length - 1, originalEnd);

					if (originalStart < originalEnd) {
						highlightedText =
							highlightedText.slice(0, originalStart) +
							`<span class="highlight">${highlightedText.slice(originalStart, originalEnd + 1)}</span>` +
							highlightedText.slice(originalEnd + 1);
					}
				}
			});
	}

	return highlightedText;
}

function copyToClipboard(text) {
	navigator.clipboard.writeText(text).then(() => {
		console.log('Copied to clipboard:', text);
		showPopup(); // Show popup on successful copy
	}).catch(err => {
		console.error('Failed to copy:', err);
	});
}

// Function to show the popup on copy
function showPopup() {
	const popup = document.getElementById("popup");
	popup.classList.add("show"); // Add the 'show' class to display the popup

	// Remove the popup after 2.5 seconds
	setTimeout(() => {
		popup.classList.remove('show');
	}, 2500);
}
