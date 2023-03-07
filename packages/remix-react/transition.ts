import type { Location, NavigationType as Action } from "react-router-dom";

export interface CatchData<T = any> {
  status: number;
  statusText: string;
  data: T;
}

export interface Submission {
  action: string;
  method: string;
  formData: FormData;
  encType: string;
  key: string;
}

export interface ActionSubmission extends Submission {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
}

export interface LoaderSubmission extends Submission {
  method: "GET";
}

export type Redirects = {
  Loader: {
    isRedirect: true;
    type: "loader";
    setCookie: boolean;
  };
  Action: {
    isRedirect: true;
    type: "action";
    setCookie: boolean;
  };
  LoaderSubmission: {
    isRedirect: true;
    type: "loaderSubmission";
    setCookie: boolean;
  };
  FetchAction: {
    isRedirect: true;
    type: "fetchAction";
    setCookie: boolean;
  };
};

// TODO: keep data around on resubmission?
export type FetcherStates<TData = any> = {
  Idle: {
    state: "idle";
    type: "init";
    formMethod: undefined;
    formAction: undefined;
    formData: undefined;
    formEncType: undefined;
    submission: undefined;
    data: undefined;
  };
  SubmittingAction: {
    state: "submitting";
    type: "actionSubmission";
    formMethod: ActionSubmission["method"];
    formAction: string;
    formData: FormData;
    formEncType: string;
    submission: ActionSubmission;
    data: TData | undefined;
  };
  SubmittingLoader: {
    state: "submitting";
    type: "loaderSubmission";
    formMethod: LoaderSubmission["method"];
    formAction: string;
    formData: FormData;
    formEncType: string;
    submission: LoaderSubmission;
    data: TData | undefined;
  };
  ReloadingAction: {
    state: "loading";
    type: "actionReload";
    formMethod: ActionSubmission["method"];
    formAction: string;
    formData: FormData;
    formEncType: string;
    submission: ActionSubmission;
    data: TData;
  };
  LoadingActionRedirect: {
    state: "loading";
    type: "actionRedirect";
    formMethod: ActionSubmission["method"];
    formAction: string;
    formData: FormData;
    formEncType: string;
    submission: ActionSubmission;
    data: undefined;
  };
  Loading: {
    state: "loading";
    type: "normalLoad";
    formMethod: undefined;
    formAction: undefined;
    formData: undefined;
    formEncType: undefined;
    submission: undefined;
    data: TData | undefined;
  };
  Done: {
    state: "idle";
    type: "done";
    formMethod: undefined;
    formAction: undefined;
    formData: undefined;
    formEncType: undefined;
    submission: undefined;
    data: TData;
  };
};

export type Fetcher<TData = any> =
  FetcherStates<TData>[keyof FetcherStates<TData>];

export class CatchValue {
  constructor(
    public status: number,
    public statusText: string,
    public data: any
  ) {}
}

export type NavigationEvent = {
  type: "navigation";
  action: Action;
  location: Location;
  submission?: Submission;
};

export type FetcherEvent = {
  type: "fetcher";
  key: string;
  submission?: Submission;
  href: string;
};

export type DataEvent = NavigationEvent | FetcherEvent;

export const IDLE_FETCHER: FetcherStates["Idle"] = {
  state: "idle",
  type: "init",
  data: undefined,
  formMethod: undefined,
  formAction: undefined,
  formData: undefined,
  formEncType: undefined,
  submission: undefined,
};
