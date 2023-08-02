---
title: Templates
description: The quickest way to get rocking and rolling with Remix
order: 3
---

# Templates

When using [`create-remix`][create-remix] to generate a new project, you can choose a template to quickly get up and running.

## Basic Template

If you run `create-remix` without providing the `--template` option, you'll get a basic template using the [Remix App Server][remix-app-server].

```sh
npx create-remix@latest
```

If you are not interested in using TypeScript, you can install the simpler Javascript template instead:

```sh
npx create-remix --template remix-run/remix/templates/remix-javascript
```

This is a great place to start if you're just looking to try out Remix for the first time. You can always extend this starting point yourself or migrate to a more advanced template later.

## Stacks

When a template is closer to being a production-ready application, to the point that it provides opinions about the CI/CD pipeline, database and hosting platform, the Remix community refers to these templates as "stacks".

There are several official stacks provided but you can also make your own (read more below).

[Read the feature announcement blog post][read-the-feature-announcement-blog-post] and [watch Remix Stacks videos on YouTube][watch-remix-stacks-videos-on-you-tube].

### Official Stacks

The official stacks come ready with common things you need for a production application including:

- Database
- Automatic deployment pipelines
- Authentication
- Testing
- Linting/Formatting/TypeScript

What you're left with is everything completely set up for you to just get to work building whatever amazing web experience you want to build with Remix. Here are the official stacks:

- [The Blues Stack][the-blues-stack]: Deployed to the edge (distributed) with a long-running Node.js server and PostgreSQL database. Intended for large and fast production-grade applications serving millions of users.
- [The Indie Stack][the-indie-stack]: Deployed to a long-running Node.js server with a persistent SQLite database. This stack is great for websites with dynamic data that you control (blogs, marketing, content sites). It's also a perfect, low-complexity bootstrap for MVPs, prototypes, and proof-of-concepts that can later be updated to the Blues stack easily.
- [The Grunge Stack][the-grunge-stack]: Deployed to a serverless function running Node.js with DynamoDB for persistence. Intended for folks who want to deploy a production-grade application on AWS infrastructure serving millions of users.

You can use these stacks by proving the `--template` option when running `create-remix`, for example:

```sh
npx create-remix@latest --template remix-run/blues-stack
```

Yes, these are named after music genres. 🤘 Rock on.

### Community Stacks

You can [browse the list of community stacks on GitHub.][remix-stack-topic]

Community stacks can be used by passing the GitHub username/repo combo to the `--template` option when running `create-remix`, for example:

```sh
npx create-remix@latest --template :username/:repo
```

<docs-success>If you want to share your stack with the community, don't forget to tag it with the [remix-stack][remix-stack-topic] topic so others can find it — and yes, we do recommend that you name your own stack after a music sub-genre (not "rock" but "indie"!).</docs-success>

## Regular Templates and Examples

For a less opinionated starting point, you can also just use a regular template.

The Remix repo provides a set of [templates for different environments.][official-templates]

We also provide a [community-driven examples repository,][examples] with each example showcasing different Remix features, patterns, tools, hosting providers, etc.

You can use these templates and examples by passing a GitHub shorthand to the `--template` option when running `create-remix`, for example:

```sh
npx create-remix@latest --template remix-run/examples/basic
```

### Third-Party Templates

Some hosting providers maintain their own Remix templates. For more information, see their official integration guides listed below.

- [Netlify][netlify-remix]
- [Vercel][vercel-remix]

### Private Templates

If your template is in a private GitHub repo, you can pass a GitHub token via the `--token` option:

```sh
npx create-remix@latest --template your-private/repo --token yourtoken
```

The [token just needs `repo` access][repo access token].

### Local Templates

You can provide a local directory or tarball on disk to the `--template` option, for example:

```sh
npx create-remix@latest --template /my/remix-stack
npx create-remix@latest --template /my/remix-stack.tar.gz
npx create-remix@latest --template file:///Users/michael/my-remix-stack.tar.gz
```

### Custom Template Tips

#### Dependency Versions

If you set any dependencies in package.json to `*`, the Remix CLI will change it to a semver caret of the installed Remix version:

```diff
-   "remix": "*",
+   "remix": "^1.2.3",
```

This allows you to not have to regularly update your template to the latest version of that specific package. Of course, you do not have to put `*` if you'd prefer to manually manage the version for that package.

#### Customize Initialization

If the template has a `remix.init/index.js` file at the root then that file will be executed after the project has been generated and dependencies have been installed. This gives you a chance to do anything you'd like as part of the initialization of your template. For example, in the blues stack, the `app` property has to be globally unique, so we use the `remix.init/index.js` file to change it to the name of the directory that was created for the project + a couple random characters.

You could even use `remix.init/index.js` to ask further questions to the developer for additional configuration (using something like [inquirer][inquirer]). Sometimes, you'll need dependencies installed to do this, but those deps are only useful during initialization. In that case, you can also create a `remix.init/package.json` with dependencies and the Remix CLI will install those before running your script.

After the init script has been run, the `remix.init` folder gets deleted, so you don't need to worry about it cluttering up the finished codebase.

<docs-warning>Do note that consumers can opt out of running the remix.init script. To do so manually, they'll need to run `remix init`.</docs-warning>

[create-remix]: /other-api/create-remix

[remix-app-server]: [/other-api/serve]
[repo access token]: https://github.com/settings/tokens/new?description=Remix%20Private%20Stack%20Access&scopes=repo
[inquirer]: https://npm.im/inquirer
[read-the-feature-announcement-blog-post]: /blog/remix-stacks
[watch-remix-stacks-videos-on-you-tube]: https://www.youtube.com/playlist?list=PLXoynULbYuEC8-gJCqyXo94RufAvSA6R3
[the-blues-stack]: https://github.com/remix-run/blues-stack
[the-indie-stack]: https://github.com/remix-run/indie-stack
[the-grunge-stack]: https://github.com/remix-run/grunge-stack
[remix-stack-topic]: https://github.com/topics/remix-stack
[official-templates]: https://github.com/remix-run/remix/tree/main/templates
[examples]: https://github.com/remix-run/examples
[vercel-remix]: https://vercel.com/docs/frameworks/remix
[netlify-remix]: https://docs.netlify.com/integrations/frameworks/remix
