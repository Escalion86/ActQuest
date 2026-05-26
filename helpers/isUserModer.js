const isUserModer = (user) => ['admin', 'dev'].includes(user?.role)

export default isUserModer
