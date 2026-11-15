// The Shelf colours, copied from the design spec ("Colours" and "Charts").
// src/app.css declares the same values; tokens.test.ts keeps the two in step.

export interface Palette {
	ground: string;
	ink: string;
	muted: string;
	hairline: string;
	track: string;
	accent: string;
	onInk: string;
}

export const LIGHT: Palette = {
	ground: '#ECEEE8',
	ink: '#18201C',
	muted: '#4A534D',
	hairline: '#C2C8BE',
	track: '#D5DAD1',
	accent: '#C8321F',
	onInk: '#ECEEE8'
};

export const DARK: Palette = {
	ground: '#131815',
	ink: '#E8EBE3',
	muted: '#A6B0A7',
	hairline: '#2F3933',
	track: '#3A463F',
	accent: '#E2513A',
	onInk: '#131815'
};

// Spine order: ink, cream, tan, grey, red, blue, mustard, green, plum.
export const SPINES_LIGHT = [
	'#18201C',
	'#F6F3EA',
	'#C8B899',
	'#8C8F8A',
	'#C8321F',
	'#2E5A88',
	'#D7A53A',
	'#5F7F5C',
	'#3B2A3F'
];

export const SPINES_DARK = [
	'#2B352F',
	'#F1EEE4',
	'#C8B899',
	'#8C8F8A',
	'#D9452F',
	'#4F86C2',
	'#D7A53A',
	'#7FA37B',
	'#8A6A93'
];

export const CHART_LIGHT = ['#2B66A8', '#A8770A', '#7A4E9C', '#23855A', '#C8321F'];
export const CHART_DARK = ['#5490CC', '#B98A26', '#9F7FC8', '#42A277', '#E2513A'];

export const CHART_OTHER_LIGHT = '#7C837D';
export const CHART_OTHER_DARK = '#7C867F';

// Shade ramp, fewest to most.
export const SHADES_LIGHT = ['#DDE1D8', '#AEB7AC', '#869288', '#4A574E', '#18201C'];
export const SHADES_DARK = ['#404E46', '#5C6B61', '#93A097', '#BCC5BC', '#E8EBE3'];
