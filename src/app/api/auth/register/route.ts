import { NextResponse } from 'next/server'

export async function POST(_req: Request) {
  return NextResponse.json(
    { 
      error: 'Forbidden',
      message: 'Cadastro público desabilitado. O acesso ao UTM-Track é restrito a clientes e usuários autorizados pelo administrador.' 
    },
    { status: 403 }
  )
}
