import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        memberships: {
          include: {
            workspace: true
          }
        }
      }
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error fetching account:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, currentPassword, newPassword } = body

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const updateData: { name?: string; password?: string } = {}
    if (name) updateData.name = name

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Senha atual é obrigatória para alteração de senha' }, { status: 400 })
      }

      if (user.password) {
        const isMatch = await bcrypt.compare(currentPassword, user.password)
        if (!isMatch) {
          return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
        }
      }

      updateData.password = await bcrypt.hash(newPassword, 10)
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: { id: true, name: true, email: true }
    })

    return NextResponse.json({ success: true, user: updated })
  } catch (error) {
    console.error('Error updating account:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
