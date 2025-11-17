import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OAuth2Client } from 'google-auth-library';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!
      }
    }
  }
);

const googleClient = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

export async function POST(request: Request) {
  try {
    const { credential, password } = await request.json();

    if (!credential) {
      return NextResponse.json({ error: 'No credential provided' }, { status: 400 });
    }

    // Verify the Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const googleId = payload.sub;
    const googleEmail = payload.email!;
    const googleName = payload.name;
    const googlePicture = payload.picture;

    // Check if this Google account is already linked
    const { data: existingLink, error: linkError } = await supabaseAdmin
      .from('google_account_links')
      .select('user_id')
      .eq('google_id', googleId)
      .single();

    if (linkError && linkError.code !== 'PGRST116') {
      throw linkError;
    }

    // Case 1: Google account already linked - sign them in
    if (existingLink) {
      // Update last_login_at
      await supabaseAdmin
        .from('google_account_links')
        .update({ last_login_at: new Date().toISOString() })
        .eq('google_id', googleId);

      // Get user data
      const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(
        existingLink.user_id
      );

      if (userError || !user) {
        throw new Error('User not found');
      }

      // Generate a temporary password for this sign-in session
      const tempPassword = crypto.randomUUID();

      // Update the user's password temporarily so they can sign in
      await supabaseAdmin.auth.admin.updateUserById(
        existingLink.user_id,
        { password: tempPassword }
      );

      return NextResponse.json({
        success: true,
        action: 'signin',
        userId: existingLink.user_id,
        email: user.email,
        tempPassword: tempPassword, // Client will use this to create a session
      });
    }

    // Case 2: Check if email exists with password account
    const { data: existingUser, error: userLookupError } = await supabaseAdmin
      .from('auth.users')
      .select('id, email')
      .eq('email', googleEmail)
      .single();

    // Note: Direct auth.users query might not work due to RLS, use auth.admin instead
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    const userWithEmail = authUser?.users.find(u => u.email === googleEmail);

    if (userWithEmail) {
      // Case 2a: Email exists - require password to link
      if (!password) {
        return NextResponse.json({
          success: false,
          action: 'link_required',
          message: 'An account with this email already exists. Please enter your password to link your Google account.',
          email: googleEmail,
        });
      }

      // Case 2b: Password provided - verify and link
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email: googleEmail,
        password,
      });

      if (signInError) {
        return NextResponse.json({
          success: false,
          action: 'link_failed',
          error: 'Incorrect password. Please try again.',
        }, { status: 401 });
      }

      // Link the Google account
      const { error: linkInsertError } = await supabaseAdmin
        .from('google_account_links')
        .insert({
          user_id: userWithEmail.id,
          google_id: googleId,
          google_email: googleEmail,
          google_name: googleName,
          google_picture_url: googlePicture,
        });

      if (linkInsertError) {
        console.error('Failed to insert Google link:', linkInsertError);
        throw linkInsertError;
      }

      console.log('Google account linked successfully for user:', userWithEmail.id);

      return NextResponse.json({
        success: true,
        action: 'linked_and_signin',
        message: 'Google account linked successfully!',
        email: googleEmail,
      });
    }

    // Case 3: New user - create account with Google
    // Generate a secure random password (user won't know it, but can set one later)
    const randomPassword = crypto.randomUUID() + crypto.randomUUID();

    const { data: newUser, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: googleEmail,
      password: randomPassword,
      email_confirm: true, // Auto-confirm since Google verified the email
      user_metadata: {
        name: googleName,
        picture: googlePicture,
        auth_provider: 'google',
      },
    });

    if (signUpError) throw signUpError;

    // Link the Google account
    const { error: newUserLinkError } = await supabaseAdmin
      .from('google_account_links')
      .insert({
        user_id: newUser.user.id,
        google_id: googleId,
        google_email: googleEmail,
        google_name: googleName,
        google_picture_url: googlePicture,
      });

    if (newUserLinkError) {
      console.error('Failed to insert Google link for new user:', newUserLinkError);
      throw newUserLinkError;
    }

    console.log('New user created and Google account linked:', newUser.user.id);

    return NextResponse.json({
      success: true,
      action: 'signup_and_signin',
      message: 'Account created successfully!',
      email: googleEmail,
      tempPassword: randomPassword, // Client will use this to sign in
    });

  } catch (error: any) {
    console.error('Google OAuth error:', error);
    return NextResponse.json(
      { error: error.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}
