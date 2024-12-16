// Farbtonsuche
// mittels "fuse.js" (fuzzy search)

const searchInput = document.getElementById("search");
const resultsContainer = document.getElementById("results");
const clearBtn = document.getElementById("clear-btn");

let fuses = []; // Array to hold Fuse.js instances

// Function to strip comments from JSON
function stripJsonComments(jsonString) {
	return jsonString.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim();
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
		const colors = dataArray.colorsystem.colors.map(color => ({
			...color,
			colorsystem: { name: colorsystemName }
		})); // Extract colors array and include colorsystem name
		const options = {
			keys: ["id", "vanityname"], // Fields to search
			threshold: 0.2, // Adjust for fuzziness
			includeMatches: true, // Include match information for highlighting
			useExtendedSearch: true, // Enable extended search to handle diacritics
		};
		fuses.push(new Fuse(colors, options));
	});
	//console.log("Fuse instances:", fuses); // Debugging log
}).catch(error => {
	console.error("Oopsie! Error fetching colors:", error);
});

// Filter and display results
searchInput.addEventListener("input", () => {
	const query = searchInput.value.normalize("NFC"); // Normalize input
	let results = [];

	// Search each Fuse.js instance and combine results
	fuses.forEach(fuse => {
		results = results.concat(fuse.search(query));
	});
	//console.log("Search results:", results); // Debugging log

	// Show the clear button if there's text
	clearBtn.style.display = query ? "inline" : "none";

	// Render results with highlights
	displayResults(results, query);
});

// Clear the search input and results when the clear button is clicked
clearBtn.addEventListener("click", () => {
	searchInput.value = "";
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

	const match = matches.find(m => m.key === key);
	if (!match) return text;

	let highlightedText = text;
	match.indices
		.reverse()
		.forEach(([start, end]) => {
			// Only highlight if the match length is greater than 1
			if (end - start >= 1) {
				highlightedText =
					highlightedText.slice(0, start) +
					`<span class="highlight">${highlightedText.slice(start, end + 1)}</span>` +
					highlightedText.slice(end + 1);
			}
		});

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
