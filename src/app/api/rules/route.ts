import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getUserWorkspaceId } from '@/lib/workspace'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const rules = await prisma.rule.findMany({
      where: { workspaceId },
      orderBy: { priority: 'desc' }
    })

    const parsedRules = rules.map(r => {
      let cond: any = {}
      let act: any = {}
      try { cond = JSON.parse(r.conditions) } catch { cond = { field: 'utm_campaign', operator: 'contains', value: r.conditions } }
      try { act = JSON.parse(r.actions) } catch { act = { type: 'apply_fee', value: r.actions } }

      return {
        id: r.id,
        name: r.name,
        description: r.description,
        conditionField: cond.field || 'utm_campaign',
        conditionOperator: cond.operator || 'contains',
        conditionValue: cond.value || '',
        actionType: act.type || 'apply_fee',
        actionValue: act.value || '',
        priority: r.priority,
        isActive: r.isActive,
        createdAt: r.createdAt
      }
    })

    return NextResponse.json({ rules: parsedRules })
  } catch (error) {
    console.error('Error fetching rules:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const body = await req.json()
    const { name, conditionField, conditionOperator, conditionValue, actionType, actionValue, priority } = body

    if (!name || !conditionField || !conditionValue || !actionType) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    const conditionsJson = JSON.stringify({
      field: conditionField,
      operator: conditionOperator || 'contains',
      value: conditionValue
    })

    const actionsJson = JSON.stringify({
      type: actionType,
      value: actionValue
    })

    const rule = await prisma.rule.create({
      data: {
        workspaceId,
        name,
        description: body.description || null,
        conditions: conditionsJson,
        actions: actionsJson,
        priority: priority ? parseInt(priority) : 0,
        isActive: true
      }
    })

    return NextResponse.json({ rule }, { status: 201 })
  } catch (error) {
    console.error('Error creating rule:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const body = await req.json()
    const { id, isActive, priority } = body

    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const rule = await prisma.rule.update({
      where: { id, workspaceId },
      data: {
        ...(isActive !== undefined ? { isActive } : {}),
        ...(priority !== undefined ? { priority: parseInt(priority) } : {})
      }
    })

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('Error updating rule:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const workspaceId = await getUserWorkspaceId(session.user.id)
    if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    await prisma.rule.delete({
      where: { id, workspaceId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting rule:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
