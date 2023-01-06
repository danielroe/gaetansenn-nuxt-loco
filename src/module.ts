import { writeFile, mkdir } from 'fs/promises'
import https from 'https'
import { defineNuxtModule, createResolver } from '@nuxt/kit'
import consola from 'consola'

const logger = consola.withScope('nuxt:loco')

interface ModuleOptions {
  locale: string,
  token: string,
  filter?: string[],
  fallback?: string,
  path?: string,
  disabled?: boolean
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-loco',
    configKey: 'loco'
  },
  setup (options, nuxt) {
    const parameters: any = {}
    const { resolve } = createResolver(nuxt.options.srcDir)

    if (options.fallback) {
      parameters.fallback = options.fallback
    }
    if (options.filter) {
      parameters.filter = options.filter
    }

    if (!options.path) {
      options.path = resolve('public/i18n')
    }

    let path = 'https://localise.biz/api/export/all.json'

    if (Object.keys(parameters).length) {
      path = `${path}?${(new URLSearchParams(parameters)).toString()}`
    }

    nuxt.hook('build:before', async () => {
      try {
        let response: any = await new Promise((resolve, reject) => {
          https.get({
            protocol: 'https:',
            hostname: 'localise.biz',
            path,
            method: 'GET',
            headers: {
              Authorization: `Loco ${options.token}`
            }
          }, (res) => {
            let data = ''

            res.on('data', (chunk) => {
              data += chunk
            })

            res.on('end', () => {
              resolve(JSON.parse(data))
            })
          }).on('error', reject)
        })

        if (options.locale) {
          response = {
            [`${options.locale}`]: response
          }
        }

        // Create folder if not exist
        try {
          await mkdir(options.path as string, { recursive: true })

          await Promise.all(Object.keys(response).map(async (locale) => {
            logger.info(`sync ${locale} locale`)

            await writeFile(`${options.path}/${locale}.json`, JSON.stringify(response[locale]))
          }))
        } catch (err) {
          logger.error('Unable to create folder', err)
        }
      } catch (err) {
        logger.error('Unable to fetch translation: ', err)
      }
    })
  }
})

declare module '@nuxt/schema' {
  interface NuxtConfig {
    loco?: ModuleOptions
  }
  interface NuxtOptions {
    loco?: ModuleOptions
  }
}
