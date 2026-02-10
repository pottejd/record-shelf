<script lang="ts">
	import type { DiscogsCollectionItem } from '$lib/types/discogs';

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
		return item.basic_information.artists.map(a => a.name.replace(/\s*\(\d+\)$/, '')).join(', ');
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
				options = [correctAnswer, ...shuffled.slice(1, 4).map(i => i.basic_information.title)];
				break;
			case 'year':
				correctAnswer = String(item.basic_information.year);
				const years = new Set<string>([correctAnswer]);
				while (years.size < 4) {
					const offset = Math.floor(Math.random() * 20) - 10;
					const year = item.basic_information.year + offset;
					if (year > 1900 && year <= new Date().getFullYear()) {
						years.add(String(year));
					}
				}
				options = Array.from(years);
				break;
			case 'artist':
				correctAnswer = getArtistName(item);
				const artists = new Set<string>([correctAnswer]);
				for (const other of shuffled.slice(1)) {
					if (artists.size >= 4) break;
					const otherArtist = getArtistName(other);
					if (otherArtist !== correctAnswer) {
						artists.add(otherArtist);
					}
				}
				options = Array.from(artists);
				break;
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
		try {
			currentQuestion = generateQuestion();
		} catch {
			quizActive = false;
		}
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
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" />
					<path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
					<line x1="12" y1="17" x2="12.01" y2="17" />
				</svg>
			</div>
			<p class="quiz-description">Test your knowledge of your own collection!</p>
			{#if questionsAnswered > 0}
				<p class="last-score">Last score: {score}/{questionsAnswered}</p>
			{/if}
			<button class="start-btn" onclick={startQuiz}>Start Quiz</button>
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
					class="album-cover"
					class:blur={currentQuestion.type === 'album' && !showResult}
				/>
			</div>

			<p class="question-text">{getQuestionText(currentQuestion)}</p>

			<div class="options">
				{#each currentQuestion.options as option}
					<button
						class="option-btn"
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
					<button class="next-btn" onclick={nextQuestion}>Next Question</button>
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
		gap: 1rem;
		padding: 2rem;
		text-align: center;
	}

	.quiz-icon {
		width: 64px;
		height: 64px;
		color: var(--color-primary);
		opacity: 0.6;
	}

	.quiz-icon svg {
		width: 100%;
		height: 100%;
	}

	.quiz-description {
		margin: 0;
		font-size: 0.9375rem;
		color: var(--color-text-secondary);
	}

	.last-score {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-text-tertiary);
	}

	.start-btn {
		padding: 0.75rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		background: linear-gradient(135deg, #6366f1, #8b5cf6);
		color: white;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		transition: transform 0.15s, box-shadow 0.15s;
	}

	.start-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
	}

	.quiz-question {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.question-header {
		width: 100%;
		display: flex;
		justify-content: flex-end;
	}

	.score {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-primary);
	}

	.album-preview {
		width: 140px;
		height: 140px;
	}

	.album-cover {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		transition: filter 0.3s;
	}

	.album-cover.blur {
		filter: blur(20px);
	}

	.question-text {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		text-align: center;
		color: var(--color-text);
	}

	.options {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.option-btn {
		width: 100%;
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		text-align: left;
		background: var(--color-bg-secondary);
		color: var(--color-text);
		border: 2px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		transition: background-color 0.15s, border-color 0.15s;
	}

	.option-btn:hover:not(:disabled) {
		background: var(--color-bg-tertiary);
	}

	.option-btn.selected {
		border-color: var(--color-primary);
	}

	.option-btn.correct {
		background: rgba(16, 185, 129, 0.2);
		border-color: #10b981;
	}

	.option-btn.incorrect {
		background: rgba(239, 68, 68, 0.2);
		border-color: #ef4444;
	}

	.option-btn:disabled {
		cursor: default;
	}

	.result {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.result-text {
		font-size: 1rem;
		font-weight: 600;
	}

	.result-text.correct {
		color: #10b981;
	}

	.result-text.incorrect {
		color: #ef4444;
	}

	.next-btn {
		padding: 0.5rem 1.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		background: var(--color-bg-secondary);
		color: var(--color-text);
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.next-btn:hover {
		background: var(--color-bg-tertiary);
	}
</style>
