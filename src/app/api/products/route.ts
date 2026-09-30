import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace' }, { status: 404 })
    }

    const products = await prisma.product.findMany({
      where: { workspaceId },
      include: {
        pixel: {
          select: {
            id: true,
            name: true,
            pixelId: true,
            status: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ products })
  } catch (error) {
    console.error('[API Products] Error listing products:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace' }, { status: 404 })
    }

    const body = await req.json()
    const id = body.id || body.productId
    const pixelId = body.pixelId === '' || body.pixelId === 'none' ? null : body.pixelId

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    // Se um pixelId foi informado, verificar se pertence ao workspace
    if (pixelId) {
      const pixelExists = await prisma.pixel.findFirst({
        where: { id: pixelId, workspaceId }
      })
      if (!pixelExists) {
        return NextResponse.json({ error: 'Pixel not found in this workspace' }, { status: 404 })
      }
    }

    const updatedProduct = await prisma.product.update({
      where: { id, workspaceId },
      data: {
        pixelId
      },
      include: {
        pixel: {
          select: {
            id: true,
            name: true,
            pixelId: true,
            status: true
          }
        }
      }
    })

    return NextResponse.json({ success: true, product: updatedProduct })
  } catch (error) {
    console.error('[API Products] Error updating product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace' }, { status: 404 })
    }

    const body = await req.json()
    const { name, platform, externalId, price, pixelId } = body

    if (!name) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        workspaceId,
        name,
        platform: platform || null,
        externalId: externalId || null,
        price: price ? parseFloat(price) : null,
        pixelId: pixelId || null
      },
      include: {
        pixel: {
          select: {
            id: true,
            name: true,
            pixelId: true,
            status: true
          }
        }
      }
    })

    return NextResponse.json({ success: true, product }, { status: 201 })
  } catch (error) {
    console.error('[API Products] Error creating product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
