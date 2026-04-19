import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-7xl items-center px-4 py-10">
      <div className="w-full">
        <Outlet />
      </div>
    </main>
  )
}
