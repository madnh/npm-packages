#!/usr/bin/env node

// @ts-check
// A Node script to read the packages.json file and get installed versions of all packages
// To get installed version of a package, this script run command: npm list <package-name>
// then append the output to the packages.md file

/**
 * @typedef {Object} PackageDetail
 * @property {string} packageName Name of the package
 * @property {string} configureVersion Version of the package configured in package.json
 * @property {string} versionInfo Info about the package
 * @property {string} versionInfoError Error when getting info about the installed version of the package
 * @property {PackageInfo | null} detail
 */

/**
 * @typedef {Object} PackageInfo
 */

;(async function () {
  const fs = require('fs')
  const path = require('path')
  const { exec } = require('child_process')
  const { promisify } = require('util')

  const writeFile = promisify(fs.writeFile)

  const packageJsonFile = path.resolve(process.cwd(), 'package.json')
  const packageJson = require(packageJsonFile)
  const packagesMdFile = 'packages.md'
  /**
   * @type {Object} PackageInfo
   */
  const ALL_PACKAGES = {}

  /**
   * @param {string} command
   */
  function callCommand(command) {
    return new Promise((resolve) => {
      exec(command, (error, stdout) => {
        resolve({
          ok: !error,
          stdout: !error ? stdout.trim() : '',
          error: error ? stdout.trim() : '',
        })
      })
    })
  }

  /**
   * @param {string} packageName
   */
  function getInstalledVersion(packageName) {
    return callCommand(`npm list ${packageName}`)
  }

  function getInfoOfPackage(packageName) {
    return callCommand(`npm info --json ${packageName}`)
  }

  /**
   * @param {PackageInfo} packageInfo
   * @returns {string} Markdown of the package detail
   */
  function getPackageDetailMarkdown(packageInfo) {
    return `
### ${packageInfo.packageName}

[NPM 🔗](https://www.npmjs.com/package/${packageInfo.packageName}) [Homepage 🔗](${packageInfo.detail?.homepage || ''})

${packageInfo.detail?.description ? `> ${packageInfo.detail?.description}` : ''}

**Configured version:** \`${packageInfo.configureVersion}\`
**Latest version:** \`${packageInfo.detail?.version}\`

<details>
<summary>Installed version ${packageInfo.versionInfoError ? '❌' : ''}</summary>

\`\`\`
${packageInfo.versionInfo || packageInfo.versionInfoError || 'No info'}
\`\`\`

</details>
`
  }
  const dependencies = packageJson.dependencies || {}
  const devDependencies = packageJson.devDependencies || {}

  console.log(`Found ${Object.keys(dependencies).length} dependencies and ${Object.keys(devDependencies).length} dev dependencies.`)

  console.log('\n\nGetting installed versions of packages...')

  /**
   * @param {string} jsonString
   */
  function tryParseJson(jsonString) {
    try {
      return JSON.parse(jsonString)
    } catch (error) {
      return null
    }
  }

  /**
   * @param {Array<string | number| any>} items
   */
  function mdTableRow(items) {
    return '| ' + items.map((s) => String(s).trim()).join(' | ') + ' |'
  }
  const packagesToProcess = [...Object.entries(dependencies), ...Object.entries(devDependencies)]

  for await (const [packageName, configureVersion] of packagesToProcess) {
    console.log(' - ', packageName)
    const [versionInfo, packageInfo] = await Promise.all([getInstalledVersion(packageName), getInfoOfPackage(packageName)])

    const packageInfoDetail = tryParseJson(packageInfo.stdout)

    ALL_PACKAGES[packageName] = {
      packageName,
      configureVersion,
      versionInfo: versionInfo.stdout,
      versionInfoError: versionInfo.error,
      detail: packageInfoDetail,
    }
  }

  console.log('\n\n-----------------------\n\nWriting to packages.md...')

  /**
   * @param {{string: string}} packages
   * @returns {string} Markdown of the table of packages
   */
  function packagesTable(packages) {
    return `
| # | Package |  Package version | Links | Description |
| --- | --- | --- | --- | --- |
${Object.keys(packages)
  .map((packageName, index) => {
    const packageDetail = ALL_PACKAGES[packageName]
    return mdTableRow([
      index + 1,
      `[\`${packageName}\`](#${packageName}) ${packageDetail?.versionInfoError ? '❌' : ''}`,
      `\`${packages[packageName]}\``,
      [`[NPM 🔗](https://www.npmjs.com/package/${packageName})`, packageDetail?.detail?.homepage ? `[Homepage 🔗](${packageDetail?.detail?.homepage})` : ''].filter(Boolean).join(' '),
      packageDetail?.detail?.description || '',
    ])
  })
  .join('\n')}
`
  }

  const packagesMd = `
# Packages

Found ${Object.keys(dependencies).length} dependencies and ${Object.keys(devDependencies).length} dev dependencies.

**Dependencies:** (${Object.keys(dependencies).length}) packages

${packagesTable(dependencies)}

**Dev Dependencies:** (${Object.keys(devDependencies).length}) packages

${packagesTable(devDependencies)}

## Dependencies
${Object.keys(dependencies)
  .map((packageName) => getPackageDetailMarkdown(ALL_PACKAGES[packageName]))
  .join('\n')}

## Dev Dependencies

${Object.keys(devDependencies)
  .map((packageName) => getPackageDetailMarkdown(ALL_PACKAGES[packageName]))
  .join('\n')}
`

  writeFile(packagesMdFile, packagesMd).then(() => {
    console.log(`Done! See ${packagesMdFile}`)
  })
})()
