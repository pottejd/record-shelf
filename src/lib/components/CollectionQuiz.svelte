<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';
	import { formatArtists } from '$lib/utils/discogs';
	import { pickDistinctOptions } from '$lib/utils/quiz';

	let { items }: { items: DiscogsCollectionItem[] } = $props();

	type QuizType = 'album' | 'year' | 'artist';

	interface Question {
		type: QuizType;
		item: DiscogsCollectionItem;
		options: string[];
		correctAnswer: string;
	}

	let currentQuestion: Question | null = $state(null);
	let selectedAnswer: string | null = $state(null);
	let showResult = $state(false);
	let score = $state(0);
	let questionsAnswered = $state(0);
	let quizActive = $state(false);

	function getArtistName(item: DiscogsCollectionItem): string {
		return formatArtists(item.basic_information.artists);
	}

	function generateQuestion(): Question {
		const validItems = items.filter(i =>
			i.basic_information.year &&
			i.basic_information.year > 0 &&
			i.basic_information.thumb
		);

		if (validItems.length < 4) {
			throw new Error('Not enough items for quiz');
		}

		const types: QuizType[] = ['album', 'year', 'artist'];
		const type = types[Math.floor(Math.random() * types.length)];
		const shuffled = [...validItems].sort(() => Math.random() - 0.5);
		const item = shuffled[0];

		let options: string[];
		let correctAnswer: string;

		switch (type) {
			case 'album':
				correctAnswer = item.basic_information.title;
				options = pickDistinctOptions(
					correctAnswer,
					shuffled.slice(1).map((i) => i.basic_information.title)
				);
				break;
			case 'year': {
				correctAnswer = String(item.basic_information.year);
				const years = new Set<string>([correctAnswer]);
				// Bounded so a year near the 1900 floor can't spin forever.
				for (let attempt = 0; attempt < 50 && years.size < 4; attempt++) {
					const offset = Math.floor(Math.random() * 20) - 10;
					const year = item.basic_information.year + offset;
					if (year > 1900 && year <= new Date().getFullYear()) {
						years.add(String(year));
					}
				}
				options = Array.from(years);
				break;
			}
			case 'artist':
				correctAnswer = getArtistName(item);
				options = pickDistinctOptions(correctAnswer, shuffled.slice(1).map(getArtistName));
				break;
		}

		// A collection with duplicate titles/artists (or a too-narrow year range)
		// can yield fewer than 4 distinct options — reject so the caller retries.
		if (options.length < 4) {
			throw new Error('Not enough distinct options');
		}

		return {
			type,
			item,
			options: options.sort(() => Math.random() - 0.5),
			correctAnswer
		};
	}

	function startQuiz() {
		score = 0;
		questionsAnswered = 0;
		quizActive = true;
		nextQuestion();
	}

	function nextQuestion() {
		selectedAnswer = null;
		showResult = false;
		// Retry across random types/items: a single draw can be unusable (duplicate
		// options) even when the collection can produce a valid question.
		for (let attempt = 0; attempt < 8; attempt++) {
			try {
				currentQuestion = generateQuestion();
				return;
			} catch {
				// try another draw
			}
		}
		quizActive = false;
	}

	function selectAnswer(answer: string) {
		if (showResult) return;
		selectedAnswer = answer;
		showResult = true;
		questionsAnswered++;
		if (answer === currentQuestion?.correctAnswer) {
			score++;
		}
	}

	function getQuestionText(q: Question): string {
		switch (q.type) {
			case 'album':
				return 'What album is this?';
			case 'year':
				return 'What year was this released?';
			case 'artist':
				return 'Who made this album?';
		}
	}
</script>

<div class="collection-quiz">
	{#if !quizActive}
		<div class="quiz-start">
			<div class="quiz-icon">
				<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" />
					<path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
					<line x1="12" y1="17" x2="12.01" y2="17" />
				</svg>
			</div>
			<p class="quiz-description">Test how well you know this collection!</p>
			{#if questionsAnswered > 0}
				<p class="last-score">Last score: {score}/{questionsAnswered}</p>
			{/if}
			<button class="start-btn btn btn-primary" onclick={startQuiz}>Start Quiz</button>
		</div>
	{:else if currentQuestion}
		<div class="quiz-question">
			<div class="question-header">
				<span class="score">Score: {score}/{questionsAnswered}</span>
			</div>

			<div class="album-preview">
				<img
					src={currentQuestion.item.basic_information.cover_image || currentQuestion.item.basic_information.thumb}
					alt="Mystery album"
					class="album-cover cover"
					class:blur={currentQuestion.type === 'album' && !showResult}
				/>
			</div>

			<p class="question-text">{getQuestionText(currentQuestion)}</p>

			<div class="options">
				{#each currentQuestion.options as option}
					<button
						class="option-btn btn btn-secondary"
						class:selected={selectedAnswer === option}
						class:correct={showResult && option === currentQuestion.correctAnswer}
						class:incorrect={showResult && selectedAnswer === option && option !== currentQuestion.correctAnswer}
						onclick={() => selectAnswer(option)}
						disabled={showResult}
					>
						{option}
					</button>
				{/each}
			</div>

			{#if showResult}
				<div class="result">
					{#if selectedAnswer === currentQuestion.correctAnswer}
						<span class="result-text correct">Correct!</span>
					{:else}
						<span class="result-text incorrect">
							Wrong! It was {currentQuestion.correctAnswer}
						</span>
					{/if}
					<button class="next-btn btn btn-secondary" onclick={nextQuestion}>Next Question</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.collection-quiz {
		min-height: 300px;
	}

	.quiz-start {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		padding: 32px 0;
		text-align: center;
	}

	.quiz-icon {
		width: 56px;
		height: 56px;
		color: var(--muted);
	}

	.quiz-icon svg {
		width: 100%;
		height: 100%;
	}

	.quiz-description {
		margin: 0;
		font-size: 18px;
	}

	.last-score {
		margin: 0;
		font-size: 15px;
		color: var(--muted);
	}

	.quiz-question {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.question-header {
		width: 100%;
		display: flex;
		justify-content: flex-end;
	}

	.score {
		font-size: 17px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.album-preview {
		width: 140px;
		height: 140px;
		overflow: hidden;
		background: var(--track);
	}

	.album-cover {
		height: 100%;
		transition: filter 0.3s;
	}

	.album-cover.blur {
		filter: blur(20px);
	}

	.question-text {
		margin: 0;
		font-size: 24px;
		font-weight: 700;
		letter-spacing: -0.01em;
		line-height: 1.15;
		text-align: center;
	}

	.options {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	/* Answers are secondary buttons. Once answered, the right one fills with ink and
	   a wrong pick is struck through; the line below says which in words. */
	.option-btn {
		width: 100%;
		justify-content: flex-start;
		padding: 8px 16px;
		font-size: 17px;
		line-height: 1.3;
		text-align: left;
	}

	.option-btn:hover:not(:disabled) {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.option-btn:disabled {
		opacity: 1;
		cursor: default;
	}

	.option-btn.correct {
		background: var(--ink);
		color: var(--on-ink);
	}

	.option-btn.incorrect {
		text-decoration: line-through;
	}

	.result {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		margin-top: 8px;
	}

	.result-text {
		font-size: 18px;
		font-weight: 700;
		text-align: center;
	}
</style>
