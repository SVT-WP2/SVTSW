const globalSetup = () => {
    // Set UTC timezone for all tests
    process.env.TZ = 'UTC'
}

module.exports = globalSetup
