const form = document.querySelector('form');
const nameInput = document.querySelector('#name-input');
const resultsDiv = document.querySelector('#results');

form.addEventListener('submit', async (event) => {
	event.preventDefault();

	const response = await fetch('farrow-ball.json');
	const data = await response.json();

	const name = nameInput.value;
	const matches = data.filter((item) => item.name === name);

	if (matches.length > 0) {
		resultsDiv.innerHTML = `Found ${matches.length} match(es): ${matches.map((item) => item.name).join(', ')}`;
	} else {
		resultsDiv.innerHTML = 'No matches found.';
	}
});
