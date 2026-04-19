import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { AppProviders } from '#/components/layout/app-providers'
import { createLayoutInitScript } from '#/lib/layout/persistence'

import appCss from '../styles.css?url'

const LAYOUT_INIT_SCRIPT = createLayoutInitScript()
const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=stored==='light'||stored==='dark'||stored==='system'?stored:'system';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='dark'||(mode==='system'&&prefersDark);document.documentElement.classList.toggle('dark',resolved);document.documentElement.style.colorScheme=resolved?'dark':'light';}catch(e){}})();`
const DOCUMENT_INIT_SCRIPT = `${LAYOUT_INIT_SCRIPT}${THEME_INIT_SCRIPT}`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Meridian Control Room',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: DOCUMENT_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="min-h-screen font-sans antialiased [overflow-wrap:anywhere]">
        <AppProviders>
          {children}
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
          <Scripts />
        </AppProviders>
      </body>
    </html>
  )
}
