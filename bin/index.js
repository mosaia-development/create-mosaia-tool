#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const https = require('https')
const { extract } = require('tar')
const readline = require('readline')

function slugify(str) {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function prompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    return new Promise(resolve => rl.question(question, answer => {
        rl.close()
        resolve(answer)
    }))
}

async function promptWithMinLength(question, minLength) {
    while (true) {
        const answer = await prompt(question)
        if (answer.trim().length >= minLength) return answer.trim()
        console.log(`Input must be at least ${minLength} characters.`)
    }
}

function interpolate(content, vars) {
    for (const [key, value] of Object.entries(vars)) {
        const regex = new RegExp(`"${key}"`, 'g')
        content = content.replace(regex, `"${value}"`)
    }
    return content
}

async function download(url, destPath) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            if (res.statusCode !== 200) return reject(new Error(`Request failed: ${res.statusCode}`))
            const file = fs.createWriteStream(destPath)
            res.pipe(file)
            file.on('finish', () => file.close(resolve))
            file.on('error', reject)
        }).on('error', reject)
    })
}

async function main() {
    const TOOL_DISPLAY_NAME = await promptWithMinLength('Tool Display Name (user-facing, min length: 5): ', 5)
    const SHORT_TOOL_DESCRIPTION = await promptWithMinLength('Short Tool Description (user-facing, min length: 30): ', 30)
    const LONG_TOOL_DESCRIPTION = await promptWithMinLength('Long Tool Description (llm-facing, min length: 30): ', 30)

    const targetDirArg = process.argv[2]
    const slug = slugify(TOOL_DISPLAY_NAME)
    const outputDir = path.resolve(targetDirArg || slug)
    const tempTarballPath = path.join(outputDir, 'repo.tar.gz')
    const tarballUrl = 'https://codeload.github.com/mosaia-development/mosaia-tools-starter/tar.gz/refs/heads/main'

    if (fs.existsSync(outputDir)) {
        console.error(`Directory ${outputDir} already exists.`)
        process.exit(1)
    }

    fs.mkdirSync(outputDir, { recursive: true })

    await download(tarballUrl, tempTarballPath)
    await extract({
        file: tempTarballPath,
        cwd: outputDir,
        strip: 1
    })
    fs.rmSync(tempTarballPath, { force: true })

    const mosaiaPath = path.join(outputDir, '.mosaia')
    let content = fs.readFileSync(mosaiaPath, 'utf8')
    content = interpolate(content, { TOOL_DISPLAY_NAME, SHORT_TOOL_DESCRIPTION, LONG_TOOL_DESCRIPTION })
    fs.writeFileSync(mosaiaPath, content, 'utf8')

    console.log(`Project initialized in ${outputDir}`)
}

main().catch(err => {
    console.error(err)
    process.exit(1)
})
