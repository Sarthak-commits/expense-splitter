import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";
import { registerSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    console.log('Registration API called');
    
    // Parse request body
    let body;
    try {
      body = await req.json();
      console.log('Request body parsed:', { email: body.email, name: body.name });
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Validate input
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      console.error('Validation failed:', parsed.error);
      return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });
    }

    const { email, name, password } = parsed.data;
    console.log('Validation passed, checking existing user');

    // Check if user exists
    try {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        console.log('User already exists:', email);
        return NextResponse.json({ error: "Email already in use" }, { status: 409 });
      }
      console.log('No existing user found, proceeding with registration');
    } catch (dbError) {
      console.error('Database error during user lookup:', dbError);
      return NextResponse.json({ error: "Database connection failed" }, { status: 500 });
    }

    // Hash password
    let passwordHash;
    try {
      console.log('Hashing password...');
      passwordHash = await hash(password, 10);
      console.log('Password hashed successfully');
    } catch (hashError) {
      console.error('Password hashing failed:', hashError);
      return NextResponse.json({ error: "Password processing failed" }, { status: 500 });
    }

    // Create user
    try {
      console.log('Creating user in database...');
      const user = await prisma.user.create({
        data: { email, name, passwordHash },
        select: { id: true, email: true, name: true },
      });
      console.log('User created successfully:', user.id);
      return NextResponse.json({ user }, { status: 201 });
    } catch (createError) {
      console.error('User creation failed:', createError);
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

  } catch (err) {
    console.error('Unexpected error in registration:', err);
    return NextResponse.json({ 
      error: "Server error", 
      message: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
