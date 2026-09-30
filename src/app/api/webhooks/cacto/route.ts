import { POST as caktoPost } from '../cakto/route'

export async function POST(req: Request) {
  return caktoPost(req)
}
