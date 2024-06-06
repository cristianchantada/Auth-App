import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environments';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthStatus, LoginResponse, User, CheckTokenResponse, RegisterResponse } from '../interfaces';
import { Observable, catchError, map, mergeMap, of, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

	private readonly baseUrl: string = environment.baseUrl;
	private http = inject(HttpClient);

	private _currentUser = signal<User | null>(null);
	private _authStatus = signal<AuthStatus>(AuthStatus.checking);

	//Exponemos al mundo exterior
	public currentUser = computed(() => this._currentUser());
	public authStatus = computed(() => this._authStatus());

  constructor() {
		this.checkAuthStatus().subscribe();
	}

	private setAuthentication(user: User, token: string): boolean {
		this._currentUser.set(user);
		this._authStatus.set(AuthStatus.authenticated);
		localStorage.setItem('token', token);
		return true;
	}

	login(email: string, password: string): Observable<boolean>{

		const url = `${this.baseUrl}/auth/login`;
		const body = {email, password}

		return this.http.post<LoginResponse>(url, body)
			.pipe(
				map( ({user, token}) =>  this.setAuthentication(user, token)),
				catchError( err =>  throwError( () => err.error.message))
			)
	}

	register(name: string, email: string, password: string): Observable<boolean> {
    const url = `${this.baseUrl}/auth/register`;
    const body = { name, email, password };

    return this.http.post<RegisterResponse>(url, body)
      .pipe(
            mergeMap(({ user, token }) => {
                const { email } = user;
                // Llama a login y maneja su resultado o error aquí
                return this.login(email, password).pipe(
                    catchError(err => {
                        // Maneja el error de login aquí
                        console.error('Error during login after registration:', err);
                        return of(false); // Retorna false si hay un error
                    }),
                    map(success => {
                        if (success) {
                            // Si login fue exitoso, retorna true
                            return true;
                        }
                        return false; // De lo contrario, retorna false
                    })
                );
            }),
            catchError(err => {
                // Maneja el error de registro aquí
                console.error('Registration error:', err.error.message);
                return throwError(() => err.error.message); // Corrige el uso de throwError
            })
        );
}



	checkAuthStatus(): Observable<boolean> {

		const url = `${this.baseUrl}/auth/check-token`;
		const token = localStorage.getItem('token');

		if(!token){
			this.logout();
			return of(false);
		}

		const headers = new HttpHeaders()
			.set('Authorization', `Bearer ${ token }`);

		return this.http.get<CheckTokenResponse>(url, {headers})
			.pipe(
				map( ({user, token}) =>  this.setAuthentication(user, token)),
				catchError(() => {
					this._authStatus.set(AuthStatus.notAuthenticated);
					return of(false)})
			);

	}

	logout(){
		this._currentUser.set(null);
		this._authStatus.set(AuthStatus.notAuthenticated);
		localStorage.removeItem('token');
	}

}
