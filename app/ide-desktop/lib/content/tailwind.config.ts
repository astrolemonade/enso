/** @file Configuration for Tailwind. */
/** @type {import('tailwindcss').Config} */
module.exports = {
    // FIXME[sb]: Tailwind building should be in `dashboard/`.
    content: ['../dashboard/src/authentication/src/**/*.tsx'],
    important: '#dashboard',
    theme: {
        extend: {},
    },
    corePlugins: {
        preflight: false,
    },
    plugins: [],
}
